import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { PolicyEngineService } from './policy-engine.service';
import { IsString, IsOptional, IsInt, IsBoolean, IsUUID, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyDto {
  @ApiProperty() @IsUUID() org_id: string;
  @ApiProperty({ enum: ['org', 'agent', 'agent_group'] }) @IsString() scope: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() scope_target_id?: string;
  @ApiProperty() @IsString() trigger: string;
  @ApiProperty() condition: Record<string, any>;
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
  @ApiPropertyOptional() current_trust_level?: string;
  @ApiPropertyOptional() session_mismatch?: boolean;
  @ApiPropertyOptional() new_environment?: boolean;
  @ApiPropertyOptional() resource_sensitivity?: string;
  @ApiPropertyOptional() off_hours?: boolean;
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
    });
  }
}
