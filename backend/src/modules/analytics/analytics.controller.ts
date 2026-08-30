import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsQueryDto,
  TimeSeriesQueryDto,
  UsageQueryDto,
  TopAgentsQueryDto,
  FeedbackQueryDto,
  OverviewResponseDto,
  AgentUsageItemDto,
  TimeSeriesResponseDto,
  AgentPerformanceDto,
  AgentFeedbackDto,
} from './dto/analytics.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get organization overview stats' })
  @ApiResponse({ status: 200, description: 'Overview stats', type: OverviewResponseDto })
  async getOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(query.org_id);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get per-agent usage breakdown' })
  @ApiResponse({ status: 200, description: 'Per-agent usage', type: [AgentUsageItemDto] })
  async getUsage(@Query() query: UsageQueryDto) {
    return this.analyticsService.getAgentUsage(query.org_id, query.days ?? 7);
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Get time-series usage data (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated time-series buckets', type: TimeSeriesResponseDto })
  async getTimeSeries(@Query() query: TimeSeriesQueryDto) {
    return this.analyticsService.getTimeSeries(
      query.org_id,
      query.agent_id,
      query.days ?? 7,
      query.page ?? 1,
      query.limit ?? 168,
    );
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  @ApiResponse({ status: 200, description: 'Agent performance', type: [AgentPerformanceDto] })
  async getPerformance(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getAgentPerformance(query.org_id);
  }

  @Get('feedback/:agentId')
  @ApiOperation({ summary: 'Get AI-powered feedback for an agent' })
  @ApiResponse({ status: 200, description: 'Agent feedback', type: AgentFeedbackDto })
  async getFeedback(
    @Param('agentId') agentId: string,
    @Query() query: FeedbackQueryDto,
  ) {
    return this.analyticsService.getAgentFeedback(query.org_id, agentId);
  }

  @Get('top-agents')
  @ApiOperation({ summary: 'Get top agents by usage' })
  @ApiResponse({ status: 200, description: 'Top agents' })
  async getTopAgents(@Query() query: TopAgentsQueryDto) {
    return this.analyticsService.getTopAgents(query.org_id, query.limit ?? 10);
  }
}
