import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentKey, Agent } from '../../database/entities';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class KeyRotationService {
  private readonly logger = new Logger(KeyRotationService.name);
  private readonly DEFAULT_GRACE_PERIOD_MINUTES = 15;

  constructor(
    @InjectRepository(AgentKey)
    private keyRepo: Repository<AgentKey>,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
    private auditService: AuditService,
  ) {}

  async rotateKey(
    agentId: string,
    newPublicKey: string,
    gracePeriodMinutes?: number,
  ): Promise<{ old_key_id: string; new_key_id: string; deprecated_at: Date; grace_expires_at: Date }> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    if (agent.status === 'revoked') throw new BadRequestException('Cannot rotate key for revoked agent');

    // Deprecate the current active key
    const currentKey = await this.keyRepo.findOne({
      where: { agent_id: agentId, status: 'active' },
    });

    if (currentKey) {
      const gracePeriod = gracePeriodMinutes ?? this.DEFAULT_GRACE_PERIOD_MINUTES;
      const now = new Date();
      const graceExpires = new Date(now.getTime() + gracePeriod * 60 * 1000);

      currentKey.status = 'deprecated';
      currentKey.deprecated_at = now;
      currentKey.grace_period_expires_at = graceExpires;
      await this.keyRepo.save(currentKey);

      this.logger.log(`Key ${currentKey.id} deprecated for agent ${agentId}, grace expires: ${graceExpires}`);
    }

    // Create new key
    const newKey = this.keyRepo.create({
      agent_id: agentId,
      public_key: newPublicKey,
      status: 'active',
    });
    const savedKey = await this.keyRepo.save(newKey);

    // Update agent's public key
    agent.public_key = newPublicKey;
    agent.key_rotated_at = new Date();
    await this.agentRepo.save(agent);

    // Audit log
    await this.auditService.logEntry(
      agent.org_id, 'agent', agentId,
      'key.rotated', agentId, 'allowed',
    );

    return {
      old_key_id: currentKey?.id || '',
      new_key_id: savedKey.id,
      deprecated_at: currentKey?.deprecated_at || new Date(),
      grace_expires_at: currentKey?.grace_period_expires_at || new Date(),
    };
  }

  async emergencyRevoke(agentId: string, reason: string): Promise<{ revoked_key_ids: string[] }> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);

    // Revoke ALL keys immediately (no grace period)
    const keys = await this.keyRepo.find({
      where: { agent_id: agentId, status: 'active' },
    });

    const revokedIds: string[] = [];
    for (const key of keys) {
      key.status = 'revoked';
      key.revoked_reason = reason;
      key.grace_period_expires_at = new Date(); // Immediate
      await this.keyRepo.save(key);
      revokedIds.push(key.id);
    }

    // Also revoke the agent itself
    agent.status = 'revoked';
    agent.key_revoked_at = new Date();
    await this.agentRepo.save(agent);

    // High-severity audit log
    await this.auditService.logEntry(
      agent.org_id, 'agent', agentId,
      'key.emergency_revoked', agentId, 'denied',
    );

    this.logger.warn(`EMERGENCY key revocation for agent ${agentId}: ${reason}. Revoked ${revokedIds.length} keys`);
    return { revoked_key_ids: revokedIds };
  }

  async getKeyHistory(agentId: string): Promise<AgentKey[]> {
    return this.keyRepo.find({
      where: { agent_id: agentId },
      order: { created_at: 'DESC' },
    });
  }

  // Expire deprecated keys past their grace period (call periodically)
  async expireDeprecatedKeys(): Promise<number> {
    const expired = await this.keyRepo
      .createQueryBuilder('key')
      .where('key.status = :status', { status: 'deprecated' })
      .andWhere('key.grace_period_expires_at < :now', { now: new Date() })
      .getMany();

    for (const key of expired) {
      key.status = 'revoked';
      key.revoked_reason = 'grace_period_expired';
      await this.keyRepo.save(key);
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} deprecated keys past grace period`);
    }
    return expired.length;
  }
}
