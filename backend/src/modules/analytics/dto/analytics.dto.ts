import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ── Query DTOs ──

export class AnalyticsQueryDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  org_id!: string;
}

export class TimeSeriesQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by agent ID' })
  @IsOptional()
  @IsString()
  agent_id?: string;

  @ApiPropertyOptional({ description: 'Number of days (1-90)', default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  days?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page (max 168 = 7 days × 24h)', default: 168 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(168)
  limit?: number;
}

export class UsageQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Number of days', default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  days?: number;
}

export class TopAgentsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Max agents to return', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class FeedbackQueryDto extends AnalyticsQueryDto {}

// ── Response DTOs ──

export class OverviewResponseDto {
  @ApiProperty() total_agents!: number;
  @ApiProperty() active_agents!: number;
  @ApiProperty() total_tokens!: number;
  @ApiProperty() total_actions!: number;
  @ApiProperty() success_rate!: string;
  @ApiProperty() estimated_cost!: string;
  @ApiProperty() pending_approvals!: number;
}

export class AgentUsageItemDto {
  @ApiProperty() agent_id!: string;
  @ApiProperty() agent_name!: string;
  @ApiProperty() tokens_issued!: number;
  @ApiProperty() actions_allowed!: number;
  @ApiProperty() actions_denied!: number;
  @ApiProperty() actions_pending!: number;
  @ApiProperty() avg_latency_ms!: number;
}

export class TimeSeriesBucketDto {
  @ApiProperty() hour_bucket!: string;
  @ApiProperty() tokens_issued!: number;
  @ApiProperty() actions_allowed!: number;
  @ApiProperty() actions_denied!: number;
  @ApiProperty() actions_pending!: number;
}

export class TimeSeriesResponseDto {
  @ApiProperty({ type: [TimeSeriesBucketDto] }) data!: TimeSeriesBucketDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pages!: number;
}

export class AgentPerformanceDto {
  @ApiProperty() agent_id!: string;
  @ApiProperty() agent_name!: string;
  @ApiProperty() health!: 'healthy' | 'warning' | 'critical';
  @ApiProperty() token_count!: number;
  @ApiProperty() total_actions!: number;
  @ApiProperty() success_rate!: number;
  @ApiProperty() avg_latency_ms!: number;
}

export class AgentFeedbackDto {
  @ApiProperty() agent_id!: string;
  @ApiProperty() agent_name!: string;
  @ApiProperty() health!: 'healthy' | 'warning' | 'critical';
  @ApiProperty() metrics!: {
    tokens: number;
    success_rate: number;
    denial_rate: number;
    avg_latency_ms: number;
  };
  @ApiProperty() token_trend!: 'up' | 'down' | 'stable';
  @ApiProperty() warnings!: string[];
  @ApiProperty() suggestions!: string[];
}
