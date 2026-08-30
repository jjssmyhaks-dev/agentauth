import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RevokeSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class VerifyContextDto {
  @ApiProperty() source_ip?: string;
  @ApiPropertyOptional() host_fingerprint?: string;
  @ApiPropertyOptional() orchestrator_id?: string;
}

@ApiTags('Sessions')
@Controller('v1/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List sessions (optionally filter by agent and status)' })
  async findAll(@Query('agent_id') agentId?: string, @Query('status') status?: string) {
    return this.sessionsService.findAll(agentId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session details' })
  async findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify current request context matches session fingerprint' })
  async verifyContext(@Param('id') id: string, @Body() dto: VerifyContextDto) {
    return this.sessionsService.verifyContext(id, dto);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke a session (emergency)' })
  async revoke(@Param('id') id: string, @Body() dto: RevokeSessionDto) {
    return this.sessionsService.revoke(id, dto.reason);
  }
}
