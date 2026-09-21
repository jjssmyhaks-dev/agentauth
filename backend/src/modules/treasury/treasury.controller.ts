import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Headers, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsObject, IsUUID, IsArray, IsBoolean, IsNumber, ValidateNested, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TreasuryService, AuthorizeInput } from './treasury.service';
import { TreasuryBudgetsService } from './budgets.service';
import { TreasuryLedgerService } from './ledger.service';
import { AUTH_REQUEST_KEY, PublicApi } from '../auth/api-key.guard';
import { RailsService } from './rails/rails.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TreasuryRailConnection } from '../../database/entities';

class AmountDto {
  @IsString() @IsNotEmpty() value: string;
  @IsString() @IsNotEmpty() asset: string;
}

class AuthorizeDto {
  @IsOptional() @IsString() task_ref?: string;
  @IsIn(['manual', 'x402', 'card', 'upi_uap']) rail: string;
  @ValidateNested() @Type(() => AmountDto) amount: AmountDto;
  @IsObject() counterparty: { kind?: string; identifier: string };
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsIn(['sandbox', 'live']) environment?: 'sandbox' | 'live';
  @IsOptional() @IsObject() rail_details?: Record<string, any>;
  @IsOptional() @IsString() agent_id?: string; // resolved from auth context when absent
  @IsOptional() @IsString() proof?: string;
}

class ConfirmDto {
  @IsString() @IsNotEmpty() rail_ref: string;
  @IsOptional() @IsString() note?: string;
}

class PolicyDto {
  @IsString() @IsNotEmpty() name: string;
  @IsObject() document: Record<string, any>;
  @IsOptional() @IsString() created_by?: string;
}

class PolicyVersionDto {
  @IsObject() document: Record<string, any>;
  @IsOptional() @IsString() created_by?: string;
}

class SimulateDto {
  @IsArray() intents: Array<Record<string, any>>;
}

class MandateDto {
  @IsUUID() agent_id: string;
  @IsString() @IsNotEmpty() granted_by: string;
  @IsUUID() policy_version_id: string;
  @IsObject() hard_limits: Record<string, any>;
  @IsString() valid_from: string;
  @IsString() valid_until: string;
  @IsString() signature: string;
  @IsIn(['webauthn', 'eip712', 'ed25519_test']) signing_method: string;
  @IsString() signing_key_ref: string;
}

class RevokeMandateDto {
  @IsString() @IsNotEmpty() revoked_by: string;
  @IsOptional() @IsString() reason?: string;
}

class BudgetDto {
  @IsString() @IsNotEmpty() name: string;
  @IsIn(['org', 'team', 'agent', 'task']) scope_type: string;
  @IsOptional() @IsString() scope_id?: string;
  @IsOptional() @IsString() parent_budget_id?: string;
  @IsString() @IsNotEmpty() asset_code: string;
  @IsIn(['one_time', 'daily', 'weekly', 'monthly', 'rolling_30d']) period_kind: string;
  @IsString() @IsNotEmpty() limit_minor: string;
}

class BudgetPatchDto {
  @IsOptional() @IsString() limit_minor?: string;
  @IsOptional() @IsIn(['active', 'paused', 'archived']) status?: string;
  @IsOptional() @IsString() name?: string;
}

class DecideApprovalDto {
  @IsString() @IsNotEmpty() principal_id: string;
  @IsIn(['approve', 'deny']) decision: string;
  @IsString() @IsNotEmpty() signature: string;
  @IsOptional() @IsString() channel?: string;
}

class KillSwitchDto {
  @IsIn(['org', 'agent', 'rail']) scope_type: string;
  @IsOptional() @IsString() scope_id?: string;
  @IsString() @IsNotEmpty() engaged_by: string;
  @IsOptional() @IsString() reason?: string;
}

class RailConnectionDto {
  @IsIn(['manual', 'x402', 'card', 'upi_uap']) rail: string;
  @IsString() @IsNotEmpty() provider: string;
  @IsIn(['sandbox', 'live']) environment: string;
  @IsString() @IsNotEmpty() display_name: string;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

class CounterpartyDto {
  @IsIn(['merchant', 'api_service', 'agent', 'wallet', 'bank_account']) kind: string;
  @IsString() @IsNotEmpty() identifier: string;
  @IsOptional() @IsString() display_name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() list_name?: string;
  @IsOptional() @IsBoolean() allowlisted?: boolean;
  @IsOptional() @IsBoolean() denylisted?: boolean;
}

function orgFrom(request: any, fallback?: string): string {
  const auth = request?.[AUTH_REQUEST_KEY];
  if (auth?.org_id) return auth.org_id;
  if (!fallback) throw new Error('org_id is required');
  return fallback;
}

@ApiTags('Treasury')
@Controller('v1/treasury')
export class TreasuryController {
  constructor(
    private readonly treasury: TreasuryService,
    private readonly budgets: TreasuryBudgetsService,
    private readonly ledger: TreasuryLedgerService,
    private readonly rails: RailsService,
    @InjectRepository(TreasuryRailConnection)
    private readonly railConnectionRepo: Repository<TreasuryRailConnection>,
  ) {}

  // ── Payments (agent-facing) ──────────────────────────────────────────────

  @Post('payments/authorize')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a payment intent and get the deterministic decision' })
  async authorize(
    @Req() request: any,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: AuthorizeDto,
  ) {
    if (!idempotencyKey) {
      return { statusCode: 400, code: 'idempotency_key_required', message: 'Idempotency-Key header is required' };
    }
    const orgId = orgFrom(request, dto.environment === 'live' ? undefined : request?.query?.org_id);
    const agentId = dto.agent_id || request?.[AUTH_REQUEST_KEY]?.agent_id;
    if (!agentId) {
      return { statusCode: 400, code: 'agent_required', message: 'agent_id (or an agent-keyed auth context) is required' };
    }
    const input: AuthorizeInput = { ...dto, org_id: orgId, agent_id: agentId, rail: dto.rail as any };
    return this.treasury.authorize(input, idempotencyKey);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Poll intent status' })
  async getIntent(@Req() request: any, @Param('id') id: string, @Query('org_id') orgId?: string) {
    return this.treasury.getIntent(id, orgFrom(request, orgId));
  }

  @Post('payments/:id/confirm')
  @ApiOperation({ summary: 'Report rail evidence; captures the reservation' })
  async confirm(@Req() request: any, @Param('id') id: string, @Body() dto: ConfirmDto, @Query('org_id') orgId?: string) {
    return this.treasury.confirm(id, orgFrom(request, orgId), dto);
  }

  @Post('payments/:id/cancel')
  @ApiOperation({ summary: 'Cancel the intent and release the reservation' })
  async cancel(@Req() request: any, @Param('id') id: string, @Query('org_id') orgId?: string) {
    return this.treasury.cancel(id, orgFrom(request, orgId));
  }

  @Get('payments')
  @ApiOperation({ summary: 'List recent intents' })
  async listIntents(@Req() request: any, @Query('org_id') orgId?: string, @Query('limit') limit?: string) {
    return this.treasury.listIntents(orgFrom(request, orgId), limit ? parseInt(limit, 10) : 50);
  }

  // ── Policies ─────────────────────────────────────────────────────────────

  @Post('policies')
  @ApiOperation({ summary: 'Create a policy with its first immutable version' })
  async createPolicy(@Req() request: any, @Body() dto: PolicyDto, @Query('org_id') orgId?: string) {
    return this.treasury.createPolicy(orgFrom(request, orgId), dto.name, dto.document, dto.created_by);
  }

  @Get('policies')
  @ApiOperation({ summary: 'List policies with latest version documents' })
  async listPolicies(@Req() request: any, @Query('org_id') orgId?: string) {
    return this.treasury.listPolicies(orgFrom(request, orgId));
  }

  @Post('policies/:id/versions')
  @ApiOperation({ summary: 'Add a new immutable draft version' })
  async addVersion(@Req() request: any, @Param('id') id: string, @Body() dto: PolicyVersionDto, @Query('org_id') orgId?: string) {
    return this.treasury.addPolicyVersion(orgFrom(request, orgId), id, dto.document, dto.created_by);
  }

  @Post('policies/:id/versions/:version/simulate')
  @ApiOperation({ summary: 'Replay synthetic intents against a version (activation gate)' })
  async simulate(@Req() request: any, @Param('id') id: string, @Param('version') version: string, @Body() dto: SimulateDto, @Query('org_id') orgId?: string) {
    return this.treasury.simulatePolicyVersion(orgFrom(request, orgId), id, parseInt(version, 10), dto.intents as any[]);
  }
  // version comes from the path — no body duplication

  @Post('policies/:id/versions/:version/activate')
  @ApiOperation({ summary: 'Activate a simulated version' })
  async activate(@Req() request: any, @Param('id') id: string, @Param('version') version: string, @Query('org_id') orgId?: string) {
    return this.treasury.activatePolicyVersion(orgFrom(request, orgId), id, parseInt(version, 10));
  }

  // ── Mandates ─────────────────────────────────────────────────────────────

  @Post('mandates')
  @ApiOperation({ summary: 'Create a signed mandate binding an agent to a policy version' })
  async createMandate(@Req() request: any, @Body() dto: MandateDto, @Query('org_id') orgId?: string) {
    return this.treasury.createMandate({
      org_id: orgFrom(request, orgId),
      agent_id: dto.agent_id,
      granted_by: dto.granted_by,
      policy_version_id: dto.policy_version_id,
      hard_limits: dto.hard_limits,
      valid_from: new Date(dto.valid_from),
      valid_until: new Date(dto.valid_until),
      signature: dto.signature,
      signing_method: dto.signing_method as any,
      signing_key_ref: dto.signing_key_ref,
    });
  }

  @Get('mandates')
  @ApiOperation({ summary: 'List mandates (optionally per agent)' })
  async listMandates(@Req() request: any, @Query('org_id') orgId?: string, @Query('agent_id') agentId?: string) {
    return this.treasury.listMandates(orgFrom(request, orgId), agentId);
  }

  @Post('mandates/:id/revoke')
  @ApiOperation({ summary: 'Revoke a mandate; blocks new authorizations immediately' })
  async revokeMandate(@Req() request: any, @Param('id') id: string, @Body() dto: RevokeMandateDto, @Query('org_id') orgId?: string) {
    return this.treasury.revokeMandate(id, orgFrom(request, orgId), dto.revoked_by, dto.reason);
  }

  // ── Budgets ──────────────────────────────────────────────────────────────

  @Post('budgets')
  @ApiOperation({ summary: 'Create a budget (hierarchical scope, single asset)' })
  async createBudget(@Req() request: any, @Body() dto: BudgetDto, @Query('org_id') orgId?: string) {
    return this.budgets.createBudget({
      org_id: orgFrom(request, orgId),
      name: dto.name,
      scope_type: dto.scope_type as any,
      scope_id: dto.scope_id ?? null,
      parent_budget_id: dto.parent_budget_id ?? null,
      asset_code: dto.asset_code,
      period_kind: dto.period_kind as any,
      limit_minor: dto.limit_minor,
    });
  }

  @Get('budgets')
  @ApiOperation({ summary: 'List budgets' })
  async listBudgets(@Req() request: any, @Query('org_id') orgId?: string) {
    return this.budgets.listForOrg(orgFrom(request, orgId));
  }

  @Patch('budgets/:id')
  @ApiOperation({ summary: 'Update budget limit/status' })
  async patchBudget(@Req() request: any, @Param('id') id: string, @Body() dto: BudgetPatchDto, @Query('org_id') orgId?: string) {
    return this.budgets.updateBudget(id, orgFrom(request, orgId), dto);
  }

  @Get('budgets/:id/remaining')
  @ApiOperation({ summary: 'Remaining authority in the current period' })
  async remaining(@Req() request: any, @Param('id') id: string, @Query('org_id') orgId?: string) {
    return this.budgets.remaining(id, orgFrom(request, orgId));
  }

  // ── Approvals ────────────────────────────────────────────────────────────

  @Get('approvals')
  @ApiOperation({ summary: 'Approval inbox with full payment context' })
  async listApprovals(@Req() request: any, @Query('org_id') orgId?: string, @Query('status') status?: string) {
    return this.treasury.listApprovals(orgFrom(request, orgId), status);
  }

  @Post('approvals/:id/decide')
  @ApiOperation({ summary: 'Sign and record an approval decision over the intent hash' })
  async decideApproval(@Req() request: any, @Param('id') id: string, @Body() dto: DecideApprovalDto, @Query('org_id') orgId?: string) {
    return this.treasury.decideApproval(id, orgFrom(request, orgId), {
      principal_id: dto.principal_id,
      decision: dto.decision as any,
      signature: dto.signature,
      channel: dto.channel,
    });
  }

  // ── Kill switch ──────────────────────────────────────────────────────────

  @Post('kill-switches')
  @ApiOperation({ summary: 'Engage the kill switch (org, agent or rail scope)' })
  async engage(@Req() request: any, @Body() dto: KillSwitchDto, @Query('org_id') orgId?: string) {
    return this.treasury.engageKillSwitch({
      org_id: orgFrom(request, orgId),
      scope_type: dto.scope_type as any,
      scope_id: dto.scope_id ?? null,
      engaged_by: dto.engaged_by,
      reason: dto.reason,
    });
  }

  @Get('kill-switches')
  @ApiOperation({ summary: 'List kill switches' })
  async listKillSwitches(@Req() request: any, @Query('org_id') orgId?: string) {
    return this.treasury.listKillSwitches(orgFrom(request, orgId));
  }

  @Delete('kill-switches/:id')
  @ApiOperation({ summary: 'Release a kill switch' })
  async release(@Req() request: any, @Param('id') id: string, @Query('org_id') orgId?: string) {
    return this.treasury.releaseKillSwitch(id, orgFrom(request, orgId));
  }

  // ── Ledger ───────────────────────────────────────────────────────────────

  @Get('ledger')
  @ApiOperation({ summary: 'Explore the hash-chained ledger' })
  async ledgerList(@Req() request: any, @Query('org_id') orgId?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.ledger.listForOrg(orgFrom(request, orgId), limit ? parseInt(limit, 10) : 100, offset ? parseInt(offset, 10) : 0);
  }

  @Get('ledger/verify')
  @ApiOperation({ summary: 'Verify the ledger hash chain' })
  async ledgerVerify(@Req() request: any, @Query('org_id') orgId?: string) {
    return this.ledger.verifyChain(orgFrom(request, orgId));
  }

  @Get('ledger/export')
  @ApiOperation({ summary: 'Export ledger entries as JSON or CSV' })
  async ledgerExport(@Req() request: any, @Query('org_id') orgId?: string, @Query('format') format?: string) {
    const { data } = await this.ledger.listForOrg(orgFrom(request, orgId), 10000, 0);
    if (format === 'csv') {
      const header = 'seq,entry_type,payment_intent_id,agent_id,amount_minor,asset_code,rail_ref,correlation_id,occurred_at,prev_hash,entry_hash';
      const rows = data.map((e) =>
        [e.seq, e.entry_type, e.payment_intent_id, e.agent_id, e.amount_minor, e.asset_code, e.rail_ref, e.correlation_id, e.occurred_at?.toISOString?.(), e.prev_hash, e.entry_hash].join(','),
      );
      return header + '\n' + rows.join('\n');
    }
    return data;
  }

  // ── Counterparties ───────────────────────────────────────────────────────

  @Post('counterparties')
  @ApiOperation({ summary: 'Register or update a counterparty' })
  async upsertCounterparty(@Req() request: any, @Body() dto: CounterpartyDto, @Query('org_id') orgId?: string) {
    return this.treasury.upsertCounterparty({ org_id: orgFrom(request, orgId), ...dto });
  }

  @Get('counterparties')
  @ApiOperation({ summary: 'List counterparties' })
  async listCounterparties(@Req() request: any, @Query('org_id') orgId?: string) {
    return this.treasury.listCounterparties(orgFrom(request, orgId));
  }

  // ── Rails (FR-PAY-2) ─────────────────────────────────────────────────

  @Get('rails')
  @ApiOperation({ summary: 'List registered rails and their capabilities' })
  listRails() {
    return this.rails.registeredRails().map((rail) => ({
      rail,
      ...this.rails.get(rail).capabilities(),
    }));
  }

  @Post('rails/connections')
  @ApiOperation({ summary: "Connect the org's own wallet-provider / issuer account (non-custodial)" })
  async createRailConnection(@Req() request: any, @Body() dto: RailConnectionDto, @Query('org_id') orgId?: string) {
    const saved = (await this.railConnectionRepo.save(
      this.railConnectionRepo.create({
        org_id: orgFrom(request, orgId),
        rail: dto.rail as any,
        provider: dto.provider,
        environment: dto.environment as any,
        display_name: dto.display_name,
        // Secrets must arrive via the KMS-encrypted path; config is non-secret only.
        config: dto.config ?? {},
        status: 'active',
      } as any),
    )) as unknown as TreasuryRailConnection;
    return { id: saved.id, rail: saved.rail, provider: saved.provider, environment: saved.environment, status: saved.status };
  }

  @Get('rails/connections')
  @ApiOperation({ summary: 'List rail connections (never includes credentials)' })
  async listRailConnections(@Req() request: any, @Query('org_id') orgId?: string) {
    const rows = await this.railConnectionRepo.find({ where: { org_id: orgFrom(request, orgId) }, order: { created_at: 'DESC' } });
    return rows.map((c) => ({
      id: c.id, rail: c.rail, provider: c.provider, environment: c.environment,
      display_name: c.display_name, status: c.status, created_at: c.created_at,
    }));
  }

  // ── Maintenance ──────────────────────────────────────────────────────────

  @Post('maintenance/sweep')
  @ApiOperation({ summary: 'Release expired reservations and approvals' })
  async sweep(@Req() request: any, @Query('org_id') orgId?: string) {
    return this.treasury.sweepExpiries(orgFrom(request, orgId));
  }
}

@ApiTags('Treasury Public')
@Controller()
export class TreasuryPublicController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get('.well-known/treasury-jwks.json')
  @PublicApi()
  @ApiOperation({ summary: 'EdDSA public keys for offline spend-token verification' })
  jwks() {
    return this.treasury.getJwks();
  }

  @Post('v1/verify')
  @HttpCode(200)
  @PublicApi()
  @ApiOperation({ summary: 'Counterparty verification of a spend token (live mandate status)' })
  async verify(@Body() dto: { token: string }) {
    return this.treasury.verifyToken(dto?.token ?? '');
  }
}
