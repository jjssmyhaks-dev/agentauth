import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../database/entities';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,
  ) {}

  async create(
    agentId: string,
    tokenJti: string,
    contextFingerprint: Record<string, any>,
    expiresAt: Date,
  ): Promise<Session> {
    const session = this.sessionRepo.create({
      agent_id: agentId,
      token_jti: tokenJti,
      context_fingerprint: contextFingerprint,
      status: 'active',
      expires_at: expiresAt,
    });
    this.logger.log(`Session created for agent ${agentId}, jti: ${tokenJti}`);
    return this.sessionRepo.save(session);
  }

  async findAll(agentId?: string, status?: string): Promise<Session[]> {
    const where: any = {};
    if (agentId) where.agent_id = agentId;
    if (status) where.status = status;
    return this.sessionRepo.find({ where, order: { created_at: 'DESC' }, take: 100 });
  }

  async verifyContext(sessionId: string, currentContext: Record<string, any>): Promise<{
    valid: boolean;
    mismatches: string[];
  }> {
    const session = await this.findOne(sessionId);
    if (session.status !== 'active') return { valid: false, mismatches: ['session_not_active'] };
    if (session.expires_at && session.expires_at < new Date()) return { valid: false, mismatches: ['session_expired'] };

    const mismatches: string[] = [];
    const stored = session.context_fingerprint;

    if (stored.source_ip && currentContext.source_ip && stored.source_ip !== currentContext.source_ip) {
      mismatches.push('source_ip_mismatch');
    }
    if (stored.host_fingerprint && currentContext.host_fingerprint && stored.host_fingerprint !== currentContext.host_fingerprint) {
      mismatches.push('host_fingerprint_mismatch');
    }
    if (stored.orchestrator_id && currentContext.orchestrator_id && stored.orchestrator_id !== currentContext.orchestrator_id) {
      mismatches.push('orchestrator_id_mismatch');
    }

    return { valid: mismatches.length === 0, mismatches };
  }

  async revoke(sessionId: string, reason?: string): Promise<Session> {
    const session = await this.findOne(sessionId);
    if (session.status !== 'active') throw new BadRequestException('Session is not active');
    session.status = 'revoked';
    session.revoke_reason = reason || 'manual_revocation';
    session.revoked_at = new Date();
    this.logger.log(`Session ${sessionId} revoked: ${reason || 'manual'}`);
    return this.sessionRepo.save(session);
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async findByTokenJti(jti: string): Promise<Session | null> {
    return this.sessionRepo.findOne({ where: { token_jti: jti } });
  }
}
