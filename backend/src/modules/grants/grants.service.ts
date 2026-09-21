import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grant } from '../../database/entities';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';
import { PolicyEngineService, PolicyContext } from '../policies/policy-engine.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalService } from '../approval/approval.service';
import { TriggerEmittersService } from '../policies/trigger-emitters.service';
import { DelegationService } from '../token/delegation.service';

@Injectable()
export class GrantsService {
  private readonly logger = new Logger(GrantsService.name);

  constructor(
    @InjectRepository(Grant)
    private grantRepo: Repository<Grant>,
    private tokenService: TokenService,
    private identityService: IdentityService,
    private policyEngine: PolicyEngineService,
    private auditService: AuditService,
    private approvalService: ApprovalService,
    private triggerEmitters: TriggerEmittersService,
    private delegationService: DelegationService,
  ) {}

  async create(
    agentId: string,
    resourceType: string,
    resourcePattern: string,
    allowedActions: string[],
    createdByUserId?: string,
    expiresAt?: Date,
    usageCap?: number,
  ): Promise<Grant> {
    const agent = await this.identityService.findOne(agentId);
    const grant = this.grantRepo.create({
      agent_id: agentId,
      org_id: agent.org_id,
      resource_type: resourceType,
      resource_pattern: resourcePattern,
      allowed_actions: allowedActions,
      created_by_user_id: createdByUserId,
      expires_at: expiresAt,
      usage_cap: usageCap,
      status: 'active',
    });
    this.logger.log(`Grant created: ${resourceType}:${resourcePattern} for agent ${agentId}`);
    return this.grantRepo.save(grant);
  }

  async findByAgent(agentId: string): Promise<Grant[]> {
    return this.grantRepo.find({ where: { agent_id: agentId }, order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<Grant> {
    const grant = await this.grantRepo.findOne({ where: { id } });
    if (!grant) throw new NotFoundException(`Grant ${id} not found`);
    return grant;
  }

  async update(id: string, expiresAt?: Date, usageCap?: number): Promise<Grant> {
    const grant = await this.findOne(id);
    if (grant.status !== 'active') throw new BadRequestException('Can only update active grants');
    if (expiresAt) grant.expires_at = expiresAt;
    if (usageCap !== undefined) grant.usage_cap = usageCap;
    return this.grantRepo.save(grant);
  }

  async revoke(id: string): Promise<Grant> {
    const grant = await this.findOne(id);
    grant.status = 'revoked';
    grant.revoked_at = new Date();
    this.logger.log(`Grant revoked: ${id}`);
    return this.grantRepo.save(grant);
  }

  async checkPermission(
    token: string,
    resourceType: string,
    resourceId: string,
    action: string,
  ): Promise<any> {
    const tokenPayload = await this.tokenService.verifyToken(token);
    if (!tokenPayload.valid) return { allowed: false, reason: 'invalid_token' };

    const agentId = tokenPayload.agent_id;
    const agent = await this.identityService.findOne(agentId);
    if (agent.status === 'revoked') return { allowed: false, reason: 'agent_revoked' };

    // Delegation chain verification: a delegated token must trace back through
    // an unbroken chain of ACTIVE delegation links to a real principal. Any
    // revoked link invalidates the whole subtree — revocation propagates.
    let delegation = tokenPayload.delegation ?? null;
    let rootAgentId: string | null = null;
    let narrowedScopes: Array<{
      resource_type: string;
      resource_pattern: string;
      allowed_actions: string[];
    }> | null = null;
    if (delegation?.delegation_id) {
      const record = await this.delegationService.findActiveByChildJti(tokenPayload.jti);
      if (!record) {
        await this.auditCheck(agent, resourceType, resourceId, action, undefined, 'denied', 'delegation_revoked');
        return { allowed: false, reason: 'delegation_revoked' };
      }
      // Authority is DERIVED: resolve the chain to its root agent. Any link
      // above revoked → the walk stops → treat the chain as broken.
      rootAgentId = await this.delegationService.resolveRootAgentId(record);
      if (rootAgentId === agentId) {
        // Degenerate chain (root === caller) — refuse rather than self-authorize.
        await this.auditCheck(agent, resourceType, resourceId, action, undefined, 'denied', 'delegation_broken');
        return { allowed: false, reason: 'delegation_broken' };
      }
      delegation = { ...delegation, depth: record.depth, delegation_id: record.id };
      // Enforce the NARROWED scope set at check time: the root's live grants
      // are the authority, but the child can only exercise what its chain
      // actually handed it. Grants outside the delegated scopes are skipped.
      narrowedScopes = (tokenPayload.scopes ?? []) as Array<{
        resource_type: string;
        resource_pattern: string;
        allowed_actions: string[];
      }>;
    }
    // Grants: the agent's own, plus (for delegated tokens) the ROOT agent's
    // live grants — delegated authority is derived from the principal that
    // started the chain.
    const allGrants = await this.grantRepo.find({
      where: rootAgentId
        ? [{ agent_id: agentId, status: 'active' }, { agent_id: rootAgentId, status: 'active' }]
        : { agent_id: agentId, status: 'active' },
    });
    const grants = narrowedScopes
      ? allGrants
          .map((g) => ({
            grant: g,
            narrowed: this.delegationService.narrowGrant(narrowedScopes!, g),
          }))
          .filter((x) => x.narrowed)
          .map((x) => ({
            ...x.grant,
            resource_pattern: x.narrowed!.resource_pattern,
            allowed_actions: x.narrowed!.allowed_actions,
          }))
      : allGrants;

    for (const grant of grants) {
      if (grant.resource_type !== resourceType) continue;
      if (!this.resourceMatches(resourceId, grant.resource_pattern)) continue;
      if (!grant.allowed_actions.includes(action)) continue;

      // Check expiry
      if (grant.expires_at && grant.expires_at < new Date()) {
        grant.status = 'expired';
        await this.grantRepo.save(grant);
        continue;
      }

      // Check usage cap
      if (grant.usage_cap && grant.usage_count >= grant.usage_cap) {
        await this.auditCheck(agent, resourceType, resourceId, action, grant.id, 'denied', 'usage_cap_reached');
        return { allowed: false, matched_grant_id: grant.id, reason: 'usage_cap_reached' };
      }

      // ✓ Grant matched. Now the policy layer decides HOW it is allowed.
      // Policies never grant — they can only restrict or gate a matched grant
      // (deny / require_approval / step_up / contextual allow rules).
      const policyCtx: PolicyContext = {
        trigger: 'permission_check',
        agent_id: agentId,
        org_id: agent.org_id,
        resource_type: resourceType,
        resource_id: resourceId,
        action,
        session_mismatch: false,
        new_environment: false,
        off_hours: this.isOffHours(),
        current_hour: new Date().getUTCHours(),
        // Caller-supplied sensitivity/trust ride on the token payload when present.
        resource_sensitivity: tokenPayload.resource_sensitivity,
        current_trust_level: tokenPayload.trust_level,
        // Delegation context: policies can gate on chain depth/root principal,
        // and every audit row for this check carries the full path.
        delegation_depth: delegation?.depth,
        root_principal_id: delegation?.root_principal_id,
      };
      const policyResult = await this.policyEngine.evaluate(policyCtx);

      // Async trigger companion: high-sensitivity access also fires the
      // dedicated resource_sensitivity_high trigger (best-effort).
      if (tokenPayload.resource_sensitivity === 'high') {
        this.triggerEmitters
          .resourceSensitivity(agent.org_id, agentId, resourceType, resourceId, 'high')
          .catch(() => {});
      }

      if (policyResult.matched && policyResult.action === 'deny') {
        await this.auditCheck(agent, resourceType, resourceId, action, grant.id, 'denied', `policy:${policyResult.policy_id}`, delegation);
        return {
          allowed: false,
          matched_grant_id: grant.id,
          matched_policy_id: policyResult.policy_id,
          reason: 'policy_denied',
          policy_reason: policyResult.reason,
        };
      }

      if (policyResult.matched && policyResult.action === 'step_up') {
        await this.auditCheck(agent, resourceType, resourceId, action, grant.id, 'denied', `step_up:${policyResult.policy_id}`);
        return {
          allowed: false,
          matched_grant_id: grant.id,
          matched_policy_id: policyResult.policy_id,
          reason: 'step_up_required',
          policy_reason: policyResult.reason,
        };
      }

      await this.grantRepo.increment({ id: grant.id }, 'usage_count', 1);

      const policyRequiresApproval =
        policyResult.matched && policyResult.action === 'require_approval';
      const requiresApproval =
        policyRequiresApproval ||
        agent.approval_mode_override === 'human_in_the_loop' ||
        tokenPayload.approval_mode === 'human_in_the_loop';

      // Close the HITL loop: a require_approval policy doesn't just flag the
      // response — it creates the pending approval the dashboard can decide.
      let approvalId: string | undefined;
      if (policyRequiresApproval) {
        try {
          const approval = await this.approvalService.create(
            agentId,
            action,
            `${resourceType}:${resourceId}`,
            {
              source: 'policy_engine',
              policy_id: policyResult.policy_id,
              policy_reason: policyResult.reason,
              matched_grant_id: grant.id,
            },
          );
          approvalId = approval.id;
        } catch (err) {
          this.logger.warn(`Failed to auto-create approval from policy: ${err}`);
        }
      }

      await this.auditCheck(
        agent, resourceType, resourceId, action, grant.id, 'allowed',
        policyResult.matched ? `policy:${policyResult.policy_id}` : undefined,
        delegation,
      );
      return {
        allowed: true,
        matched_grant_id: grant.id,
        matched_policy_id: policyResult.matched ? policyResult.policy_id : undefined,
        requires_approval: requiresApproval,
        ...(approvalId ? { approval_id: approvalId } : {}),
      };
    }

    await this.auditCheck(agent, resourceType, resourceId, action, undefined, 'denied', 'no_matching_grant');
    return { allowed: false, reason: 'no_matching_grant' };
  }

  /** Audit a permission decision (best-effort: a failed audit write must not
   *  break the authorization response). */
  private async auditCheck(
    agent: { org_id: string; id: string },
    resourceType: string,
    resourceId: string,
    action: string,
    grantId: string | undefined,
    result: 'allowed' | 'denied',
    reason?: string,
    delegation?: { depth?: number; root_principal_id?: string | null; parent_agent_id?: string } | null,
  ): Promise<void> {
    try {
      const suffix =
        delegation?.depth != null
          ? ` [chain: ${delegation.root_principal_id ?? '?'}>${delegation.parent_agent_id ?? '?'}>${agent.id} depth:${delegation.depth}]`
          : '';
      await this.auditService.logEntry(
        agent.org_id,
        'agent',
        agent.id,
        'permission.check',
        `${resourceType}:${resourceId}${action ? `#${action}` : ''}${suffix}`,
        result,
      );
    } catch (err) {
      this.logger.warn(`Failed to audit permission check: ${err}`);
    }
  }

  /** Off-hours heuristic: outside 08:00–18:00 UTC ( Mon–Fri respected by the
   *  off_hours policy author, not enforced here). */
  private isOffHours(): boolean {
    const hour = new Date().getUTCHours();
    return hour < 8 || hour >= 18;
  }

  private resourceMatches(resourceId: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return resourceId.startsWith(pattern.slice(0, -1));
    if (pattern.startsWith('*')) return resourceId.endsWith(pattern.slice(1));
    return resourceId === pattern;
  }
}
