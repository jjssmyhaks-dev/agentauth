import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Agent, AgentUsage, AuditLog } from '../../database/entities';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(AgentUsage) private usageRepo: Repository<AgentUsage>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  // ── Overview Stats ──

  async getOverview(orgId: string) {
    const agents = await this.agentRepo.find({ where: { org_id: orgId } });
    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === 'active').length;
    const totalTokens = agents.reduce((sum, a) => sum + (a.token_count || 0), 0);
    const totalActions = agents.reduce((sum, a) => sum + (a.total_actions || 0), 0);
    const totalApprovals = agents.reduce((sum, a) => sum + (a.approval_count || 0), 0);
    const totalDenials = agents.reduce((sum, a) => sum + (a.denial_count || 0), 0);

    // Success rate
    const successRate = totalActions > 0 ? ((totalApprovals / totalActions) * 100).toFixed(1) : '0.0';

    // Estimated cost (configurable price per token)
    const pricePerToken = parseFloat(process.env.TOKEN_PRICE || '0.0001');
    const estimatedCost = totalTokens * pricePerToken;

    return {
      total_agents: totalAgents,
      active_agents: activeAgents,
      total_tokens: totalTokens,
      total_actions: totalActions,
      total_approvals: totalApprovals,
      total_denials: totalDenials,
      success_rate: parseFloat(successRate),
      estimated_cost: estimatedCost,
    };
  }

  // ── Per-Agent Usage ──

  async getAgentUsage(orgId: string, days = 7) {
    const agents = await this.agentRepo.find({ where: { org_id: orgId } });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usage = await this.usageRepo
      .createQueryBuilder('u')
      .select('u.agent_id', 'agent_id')
      .addSelect('SUM(u.tokens_issued)', 'tokens')
      .addSelect('SUM(u.actions_allowed)', 'allowed')
      .addSelect('SUM(u.actions_denied)', 'denied')
      .addSelect('SUM(u.actions_pending)', 'pending')
      .addSelect('SUM(u.approvals_requested)', 'approval_requests')
      .addSelect('AVG(u.avg_latency_ms)', 'avg_latency')
      .addSelect('SUM(u.estimated_cost)', 'cost')
      .where('u.org_id = :orgId', { orgId })
      .andWhere('u.hour_bucket >= :since', { since })
      .groupBy('u.agent_id')
      .getRawMany();

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    return usage.map((u) => ({
      agent_id: u.agent_id,
      agent_name: agentMap.get(u.agent_id)?.name || 'Unknown',
      tokens: parseInt(u.tokens) || 0,
      allowed: parseInt(u.allowed) || 0,
      denied: parseInt(u.denied) || 0,
      pending: parseInt(u.pending) || 0,
      approval_requests: parseInt(u.approval_requests) || 0,
      avg_latency: parseFloat(u.avg_latency) || 0,
      cost: parseFloat(u.cost) || 0,
    }));
  }

  // ── Time Series (hourly buckets, paginated) ──

  async getTimeSeries(orgId: string, agentId?: string, days = 7, page = 1, limit = 168) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const countQb = this.usageRepo
      .createQueryBuilder('u')
      .select("COUNT(DISTINCT date_trunc('hour', u.hour_bucket))", 'count')
      .where('u.org_id = :orgId', { orgId })
      .andWhere('u.hour_bucket >= :since', { since });
    if (agentId) countQb.andWhere('u.agent_id = :agentId', { agentId });
    const { count } = await countQb.getRawOne();
    const total = parseInt(count) || 0;

    const qb = this.usageRepo
      .createQueryBuilder('u')
      .select("date_trunc('hour', u.hour_bucket)", 'hour')
      .addSelect('SUM(u.tokens_issued)', 'tokens')
      .addSelect('SUM(u.actions_allowed)', 'allowed')
      .addSelect('SUM(u.actions_denied)', 'denied')
      .addSelect('SUM(u.actions_pending)', 'pending')
      .addSelect('AVG(u.avg_latency_ms)', 'avg_latency')
      .where('u.org_id = :orgId', { orgId })
      .andWhere('u.hour_bucket >= :since', { since })
      .groupBy("date_trunc('hour', u.hour_bucket)")
      .orderBy("date_trunc('hour', u.hour_bucket)", 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (agentId) {
      qb.andWhere('u.agent_id = :agentId', { agentId });
    }

    const data = await qb.getRawMany();

    return {
      data: data.map((d) => ({
        hour: d.hour,
        tokens: parseInt(d.tokens) || 0,
        allowed: parseInt(d.allowed) || 0,
        denied: parseInt(d.denied) || 0,
        pending: parseInt(d.pending) || 0,
        avg_latency: parseFloat(d.avg_latency) || 0,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ── Agent Performance ──

  async getAgentPerformance(orgId: string) {
    const agents = await this.agentRepo.find({ where: { org_id: orgId } });

    return agents.map((a) => {
      const totalActions = a.total_actions || 0;
      const successRate = totalActions > 0
        ? ((a.approval_count / totalActions) * 100).toFixed(1)
        : '0.0';

      // Determine health based on denial rate
      const denialRate = totalActions > 0 ? (a.denial_count / totalActions) * 100 : 0;
      let health: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (denialRate > 50) health = 'critical';
      else if (denialRate > 20) health = 'warning';

      return {
        agent_id: a.id,
        agent_name: a.name,
        status: a.status,
        token_count: a.token_count || 0,
        total_actions: totalActions,
        approval_count: a.approval_count || 0,
        denial_count: a.denial_count || 0,
        success_rate: parseFloat(successRate),
        avg_latency_ms: a.avg_latency_ms || 0,
        last_active_at: a.last_active_at,
        health,
      };
    });
  }

  // ── AI Feedback ──

  async getAgentFeedback(orgId: string, agentId: string) {
    const agent = await this.agentRepo.findOne({ where: { id: agentId, org_id: orgId } });
    if (!agent) return null;

    const usage = await this.usageRepo.find({
      where: { agent_id: agentId, org_id: orgId },
      order: { hour_bucket: 'DESC' },
      take: 168, // 7 days of hourly data
    });

    const totalActions = agent.total_actions || 0;
    const denialRate = totalActions > 0 ? (agent.denial_count / totalActions) * 100 : 0;
    const successRate = totalActions > 0 ? ((agent.approval_count / totalActions) * 100) : 0;

    // Calculate trends
    const recentUsage = usage.slice(0, 24); // last 24 hours
    const priorUsage = usage.slice(24, 48); // 24-48 hours ago
    const recentTokens = recentUsage.reduce((s, u) => s + (u.tokens_issued || 0), 0);
    const priorTokens = priorUsage.reduce((s, u) => s + (u.tokens_issued || 0), 0);
    const tokenTrend = priorTokens > 0 ? ((recentTokens - priorTokens) / priorTokens * 100) : 0;

    // Generate feedback based on metrics
    const feedback: string[] = [];
    const suggestions: string[] = [];
    const warnings: string[] = [];

    // High denial rate
    if (denialRate > 30) {
      warnings.push(`High denial rate (${denialRate.toFixed(1)}%). Many actions are being blocked.`);
      suggestions.push('Review the agent\'s grants — it may need additional permissions for the resources it\'s trying to access.');
    }

    // Low activity
    if (totalActions < 10 && agent.status === 'active') {
      suggestions.push('This agent has very low activity. Consider whether it\'s properly configured and receiving traffic.');
    }

    // Token usage spike
    if (tokenTrend > 100) {
      warnings.push(`Token usage spiked ${tokenTrend.toFixed(0)}% in the last 24 hours.`);
      suggestions.push('Investigate whether this is expected behavior or a misconfiguration causing excessive token requests.');
    }

    // Token usage drop
    if (tokenTrend < -50 && priorTokens > 0) {
      suggestions.push(`Token usage dropped ${Math.abs(tokenTrend).toFixed(0)}% — the agent may be offline or experiencing errors.`);
    }

    // No recent activity
    if (!agent.last_active_at) {
      suggestions.push('This agent has never made a request. Ensure the SDK is properly configured with the correct agent ID and private key.');
    } else {
      const hoursSinceActive = (Date.now() - new Date(agent.last_active_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceActive > 24) {
        suggestions.push(`Last active ${Math.round(hoursSinceActive)} hours ago. If this agent should be active, check its connectivity.`);
      }
    }

    // Good health
    if (successRate > 90 && totalActions > 10) {
      feedback.push(`Performing well with a ${successRate.toFixed(1)}% success rate across ${totalActions} actions.`);
    }

    if (warnings.length === 0 && suggestions.length === 0) {
      feedback.push('Agent is operating normally with no issues detected.');
    }

    return {
      agent_id: agent.id,
      agent_name: agent.name,
      health: denialRate > 50 ? 'critical' : denialRate > 20 ? 'warning' : 'healthy',
      metrics: {
        total_actions: totalActions,
        success_rate: successRate,
        denial_rate: denialRate,
        token_count: agent.token_count || 0,
        avg_latency_ms: agent.avg_latency_ms || 0,
        token_trend_pct: tokenTrend,
      },
      feedback,
      suggestions,
      warnings,
    };
  }

  // ── Top Agents by Usage ──

  async getTopAgents(orgId: string, limit = 10) {
    const agents = await this.agentRepo.find({
      where: { org_id: orgId },
      order: { token_count: 'DESC' },
      take: limit,
    });

    return agents.map((a) => ({
      agent_id: a.id,
      agent_name: a.name,
      token_count: a.token_count || 0,
      total_actions: a.total_actions || 0,
      status: a.status,
    }));
  }
}
