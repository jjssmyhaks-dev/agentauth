import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KeyRotationService } from './key-rotation.service';
import { IsString, IsOptional, IsInt, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RotateKeyDto {
  @ApiProperty() @IsString() new_public_key: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) grace_period_minutes?: number;
}

export class EmergencyRevokeDto {
  @ApiProperty() @IsString() reason: string;
}

@ApiTags('Key Rotation')
@Controller('v1/agents/:agentId/keys')
export class KeyRotationController {
  constructor(private readonly keyRotationService: KeyRotationService) {}

  @Get()
  @ApiOperation({ summary: 'Get key history for an agent' })
  async getKeyHistory(@Param('agentId') agentId: string) {
    return this.keyRotationService.getKeyHistory(agentId);
  }

  @Post('rotate')
  @ApiOperation({ summary: 'Rotate agent key with deprecation grace period' })
  async rotateKey(@Param('agentId') agentId: string, @Body() dto: RotateKeyDto) {
    return this.keyRotationService.rotateKey(agentId, dto.new_public_key, dto.grace_period_minutes);
  }

  @Post('emergency-revoke')
  @ApiOperation({ summary: 'Emergency revoke all keys immediately (requires approval)' })
  async emergencyRevoke(@Param('agentId') agentId: string, @Body() dto: EmergencyRevokeDto) {
    return this.keyRotationService.emergencyRevoke(agentId, dto.reason);
  }
}
