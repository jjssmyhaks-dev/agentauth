import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrustScore, TrustEvent, Agent } from '../../database/entities';

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    @InjectRepository(TrustScore)
    private trustScoreRepo: Repository<TrustScore>,
    @InjectRepository(TrustEvent)
    private trustEventRepo: Repository<TrustEvent>,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
  ) {}

  // Scoring rules
  private readonly SCORING_RULES: Record<string, { delta: number; severity: 'info' | 'warning' | 'critical' }> = {
    new_ip: { delta: -10, severity: 'warning' },
    new_host_fingerprint: { delta: -15, severity: 'warning' },
    unusual_action_volume: { delta: -20, severity: 'warning' },
    off_hours_activity: { delta: -10, severity: 'info' },
    permission_denied_spike: { delta: -25, severity: 'warning' },
    concurrent_key_use: { delta: -40, severity: 'critical' },
    session_mismatch: { delta: -30, severity: 'critical' },
    key_rotated: { delta: -5, severity: 'info' },
  };

  // Score decay: +5 points every 30 minutes without negative events
  private readonly DECAY_RATE = 5;
  private readonly DECAY_INTERVAL_MS = 30 * 60 * 1000;

  async getTrustScore(agentId: string): Promise<TrustScore> {
    let score = await this.trustScoreRepo.findOne({ where: { agent_id: agentId } });
    if (!score) {
      score = this.trustScoreRepo.create({
        agent_id: agentId,
        score: 50,
        level: 'normal',
        last_calculated_at: new Date(),
        contributing_factors: [],
      });
      score = await this.trustScoreRepo.save(score);
    }
    return score;
  }

  async getTrustHistory(agentId: string): Promise<TrustEvent[]> {
    return this.trustEventRepo.find({
      where: { agent_id: agentId },
      order: { timestamp: 'DESC' },
      take: 100,
    });
  }

  async recordEvent(
    agentId: string,
    eventType: string,
    context: Record<string, any> = {},
  ): Promise<{ trust_score: TrustScore; event: TrustEvent }> {
    const rule = this.SCORING_RULES[eventType] || { delta: 0, severity: 'info' as const };

    // Record the event
    const event = this.trustEventRepo.create({
      agent_id: agentId,
      event_type: eventType,
      severity: rule.severity,
      raw_context: context,
      trust_delta: rule.delta,
    });
    await this.trustEventRepo.save(event);

    // Update trust score
    const score = await this.getTrustScore(agentId);
    score.score = Math.max(0, Math.min(100, score.score + rule.delta));
    score.last_calculated_at = new Date();
    score.contributing_factors = [
      { factor: eventType, delta: rule.delta, timestamp: new Date().toISOString(), context },
      ...(score.contributing_factors || []).slice(0, 49), // Keep last 50
    ];
    score.level = this.scoreToLevel(score.score);
    await this.trustScoreRepo.save(score);

    this.logger.log(`Trust event ${eventType} for agent ${agentId}: delta ${rule.delta}, new score ${score.score}`);
    return { trust_score: score, event };
  }

  async applyDecay(agentId: string): Promise<TrustScore> {
    const score = await this.getTrustScore(agentId);
    if (!score.last_calculated_at) return score;

    const elapsed = Date.now() - score.last_calculated_at.getTime();
    const decaySteps = Math.floor(elapsed / this.DECAY_INTERVAL_MS);

    if (decaySteps > 0 && score.score < 50) {
      const decayAmount = decaySteps * this.DECAY_RATE;
      score.score = Math.min(50, score.score + decayAmount);
      score.level = this.scoreToLevel(score.score);
      score.last_calculated_at = new Date();
      await this.trustScoreRepo.save(score);
    }

    return score;
  }

  private scoreToLevel(score: number): 'trusted' | 'normal' | 'questionable' | 'untrusted' {
    if (score >= 80) return 'trusted';
    if (score >= 40) return 'normal';
    if (score >= 20) return 'questionable';
    return 'untrusted';
  }
}
