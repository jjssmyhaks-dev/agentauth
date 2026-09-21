import { Controller, Get, Post, Put, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { PolicyEngineService } from './policy-engine.service';
import { IsString, IsOptional, IsInt, IsBoolean, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Triggers a policy can fire on. `permission_check` composes resource, action and
 *  context attributes (trust, off_hours, sensitivity…) into the real-time
 *  authorization flow; the others drive async/HITL event flows. */
export const POLICY_TRIGGERS = [
  'permission_check',
  'new_environment',
  'trust_below_threshold',
  'session_mismatch',
  'off_hours',
  'resource_sensitivity_high',
] as const;

export class CreatePolicyDto {
  @ApiProperty() @IsUUID() org_id: string;
  @ApiProperty({ enum: ['org', 'agent', 'agent_group'] }) @IsString() scope: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() scope_target_id?: string;
  @ApiProperty() @IsString() trigger: string;
  @ApiProperty({ description: 'Condition map: context field → expected value, $operators, or true/false shorthand' })
  @IsObject() condition: Record<string, any>;
  @ApiProperty({ enum: ['allow', 'require_approval', 'step_up', 'deny'] }) @IsString() action: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdatePolicyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() scope?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() scope_target_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trigger?: string;
  @ApiPropertyOptional() condition?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class SimulatePolicyDto {
  @ApiProperty() @IsString() trigger: string;
  @ApiProperty() @IsUUID() agent_id: string;
  @ApiProperty() @IsUUID() org_id: string;
  // Every field needs a class-validator decorator: the global ValidationPipe
  // runs with forbidNonWhitelisted, so swagger-only properties are rejected.
  @ApiPropertyOptional() @IsOptional() @IsString() current_trust_level?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() session_mismatch?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() new_environment?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() resource_sensitivity?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() off_hours?: boolean;
  // permission_check context — lets simulate mirror a real check exactly.
  @ApiPropertyOptional() @IsOptional() @IsString() resource_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resource_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() current_hour?: number;
}

@ApiTags('Policies')
@Controller('v1/policies')
export class PoliciesController {
  constructor(
    private readonly policiesService: PoliciesService,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a policy rule' })
  async create(@Body() dto: CreatePolicyDto) {
    if (!POLICY_TRIGGERS.includes(dto.trigger as (typeof POLICY_TRIGGERS)[number])) {
      throw new BadRequestException(
        `Invalid trigger "${dto.trigger}". Valid: ${POLICY_TRIGGERS.join(', ')}`,
      );
    }
    // Static sanity check: any operator-style condition must contain at least
    // one recognized $operator — the engine fails closed on unknown ones, and
    // a typo would otherwise create a policy that silently never matches.
    for (const [field, expected] of Object.entries(dto.condition ?? {})) {
      if (
        expected && typeof expected === 'object' && !Array.isArray(expected) &&
        !Object.keys(expected).some((k) =>
          ['$eq', '$ne', '$gte', '$lte', '$gt', '$lt', '$in', '$nin', '$exists'].includes(k),
        )
      ) {
        throw new BadRequestException(
          `Condition for "${field}" uses no recognized operator (known: $eq $ne $gte $lte $gt $lt $in $nin $exists)`,
        );
      }
    }
    const policy = await this.policiesService.create(
      dto.org_id, dto.scope, dto.scope_target_id || null,
      dto.trigger, dto.condition, dto.action,
      dto.priority || 0, dto.description,
    );
    return { policy_id: policy.id, status: 'created' };
  }

  @Get()
  @ApiOperation({ summary: 'List all policies for an org' })
  async findAll(@Query('org_id') orgId: string) {
    return this.policiesService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a policy by ID' })
  async findOne(@Param('id') id: string) {
    return this.policiesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a policy' })
  async update(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.policiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a policy' })
  async remove(@Param('id') id: string) {
    await this.policiesService.remove(id);
    return { deleted: true };
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simulate which policy would fire for a hypothetical event' })
  async simulate(@Body() dto: SimulatePolicyDto) {
    return this.policyEngine.simulate(dto.org_id, {
      trigger: dto.trigger,
      agent_id: dto.agent_id,
      org_id: dto.org_id,
      current_trust_level: dto.current_trust_level,
      session_mismatch: dto.session_mismatch,
      new_environment: dto.new_environment,
      resource_sensitivity: dto.resource_sensitivity,
      off_hours: dto.off_hours,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      action: dto.action,
      current_hour: dto.current_hour,
    });
  }
}
