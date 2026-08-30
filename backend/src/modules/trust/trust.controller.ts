import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TrustService } from './trust.service';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordTrustEventDto {
  @ApiProperty() @IsString() event_type: string;
  @ApiPropertyOptional() @IsOptional() context?: Record<string, any>;
}

@ApiTags('Trust')
@Controller('v1/agents/:agentId/trust')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Get()
  @ApiOperation({ summary: 'Get trust score for an agent' })
  async getTrustScore(@Param('agentId') agentId: string) {
    return this.trustService.getTrustScore(agentId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get trust event history for an agent' })
  async getTrustHistory(@Param('agentId') agentId: string) {
    return this.trustService.getTrustHistory(agentId);
  }

  @Post('events')
  @ApiOperation({ summary: 'Record a trust event and recalculate score' })
  async recordEvent(@Param('agentId') agentId: string, @Body() dto: RecordTrustEventDto) {
    return this.trustService.recordEvent(agentId, dto.event_type, dto.context || {});
  }

  @Post('decay')
  @ApiOperation({ summary: 'Apply score decay for an agent' })
  async applyDecay(@Param('agentId') agentId: string) {
    return this.trustService.applyDecay(agentId);
  }
}
