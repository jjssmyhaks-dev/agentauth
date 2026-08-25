import { IsString, IsOptional, IsArray, IsEnum, IsInt, IsUUID, IsBoolean, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Identity DTOs ──

export class RegisterAgentDto {
  @ApiProperty() @IsUUID() org_id: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() public_key: string;
}

export class RotateKeyDto {
  @ApiProperty() @IsString() new_public_key: string;
}

// ── Token DTOs ──

export class TokenRequestDto {
  @ApiProperty() @IsUUID() agent_id: string;
  @ApiProperty() @IsString() signed_challenge: string;
  @ApiProperty() @IsString() challenge_nonce: string;
}

export class TokenVerifyDto {
  @ApiProperty() @IsString() token: string;
}

// ── Grant DTOs ──

export class CreateGrantDto {
  @ApiProperty() @IsUUID() agent_id: string;
  @ApiProperty() @IsString() resource_type: string;
  @ApiProperty() @IsString() resource_pattern: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) allowed_actions: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() expires_at?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() usage_cap?: number;
}

export class UpdateGrantDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() expires_at?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() usage_cap?: number;
}

// ── Permission DTOs ──

export class PermissionCheckDto {
  @ApiProperty() @IsString() token: string;
  @ApiProperty() @IsString() resource_type: string;
  @ApiProperty() @IsString() resource_id: string;
  @ApiProperty({ enum: ['read', 'write', 'delete', 'execute'] })
  @IsString() action: string;
}

// ── Approval DTOs ──

export class CreateApprovalDto {
  @ApiProperty() @IsUUID() agent_id: string;
  @ApiProperty() @IsString() action: string;
  @ApiProperty() @IsString() resource: string;
  @ApiPropertyOptional() @IsOptional() context?: any;
}

export class DecideApprovalDto {
  @ApiProperty({ enum: ['approve', 'deny'] })
  @IsEnum(['approve', 'deny']) decision: 'approve' | 'deny';
  @ApiProperty() @IsUUID() decided_by_user_id: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

// ── Webhook DTOs ──

export class CreateWebhookDto {
  @ApiProperty() @IsUUID() org_id: string;
  @ApiProperty() @IsString() url: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) event_types: string[];
  @ApiProperty() @IsString() secret: string;
}

// ── Org DTOs ──

export class UpdateOrgSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: ['autonomous', 'human_in_loop'] })
  @IsOptional() @IsEnum(['autonomous', 'human_in_the_loop']) default_approval_mode?: string;
  @ApiPropertyOptional() @IsOptional() token_ttl_minutes?: number;
  @ApiPropertyOptional() @IsOptional() action_overrides?: Record<string, string>;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() ip_allowlist?: string[];
}
