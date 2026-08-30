import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { EnvironmentFingerprint } from '../../database/entities';

@Injectable()
export class FingerprintsService {
  private readonly logger = new Logger(FingerprintsService.name);

  constructor(
    @InjectRepository(EnvironmentFingerprint)
    private fpRepo: Repository<EnvironmentFingerprint>,
  ) {}

  async register(agentId: string, environmentInfo: Record<string, any>): Promise<EnvironmentFingerprint> {
    const fingerprintHash = this.hashFingerprint(environmentInfo);

    // Check if this fingerprint already exists for this agent
    let existing = await this.fpRepo.findOne({
      where: { agent_id: agentId, fingerprint_hash: fingerprintHash },
    });

    if (existing) {
      existing.use_count += 1;
      existing.last_seen_at = new Date();
      this.logger.log(`Known fingerprint for agent ${agentId}, use_count: ${existing.use_count}`);
      return this.fpRepo.save(existing);
    }

    // New fingerprint — mark as untrusted by default
    const fp = this.fpRepo.create({
      agent_id: agentId,
      fingerprint_hash: fingerprintHash,
      environment_info: environmentInfo,
      trusted: false,
      use_count: 1,
    });
    this.logger.log(`New fingerprint registered for agent ${agentId}`);
    return this.fpRepo.save(fp);
  }

  async findAll(agentId: string): Promise<EnvironmentFingerprint[]> {
    return this.fpRepo.find({ where: { agent_id: agentId }, order: { last_seen_at: 'DESC' } });
  }

  async trust(id: string): Promise<EnvironmentFingerprint> {
    const fp = await this.findOne(id);
    fp.trusted = true;
    return this.fpRepo.save(fp);
  }

  async untrust(id: string): Promise<EnvironmentFingerprint> {
    const fp = await this.findOne(id);
    fp.trusted = false;
    return this.fpRepo.save(fp);
  }

  async verify(agentId: string, environmentInfo: Record<string, any>): Promise<{ trusted: boolean; fingerprint_id: string }> {
    const fingerprintHash = this.hashFingerprint(environmentInfo);
    const fp = await this.fpRepo.findOne({
      where: { agent_id: agentId, fingerprint_hash: fingerprintHash },
    });

    if (!fp) {
      return { trusted: false, fingerprint_id: '' };
    }

    fp.use_count += 1;
    fp.last_seen_at = new Date();
    await this.fpRepo.save(fp);

    return { trusted: fp.trusted, fingerprint_id: fp.id };
  }

  async findOne(id: string): Promise<EnvironmentFingerprint> {
    const fp = await this.fpRepo.findOne({ where: { id } });
    if (!fp) throw new NotFoundException(`Fingerprint ${id} not found`);
    return fp;
  }

  private hashFingerprint(info: Record<string, any>): string {
    const canonical = JSON.stringify(info, Object.keys(info).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}
