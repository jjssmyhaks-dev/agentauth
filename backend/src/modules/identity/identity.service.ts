import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../database/entities';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
  ) {}

  async register(orgId: string, name: string, publicKey: string): Promise<Agent> {
    const agent = this.agentRepo.create({
      org_id: orgId,
      name,
      public_key: publicKey,
      status: 'active',
    });
    this.logger.log(`Agent registered: ${name} (org: ${orgId})`);
    return this.agentRepo.save(agent);
  }

  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async findAllByOrg(orgId: string): Promise<Agent[]> {
    return this.agentRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' } });
  }

  async rotateKey(id: string, newPublicKey: string): Promise<Agent> {
    const agent = await this.findOne(id);
    if (agent.status === 'revoked') throw new BadRequestException('Cannot rotate key for revoked agent');
    agent.public_key = newPublicKey;
    agent.key_rotated_at = new Date();
    this.logger.log(`Key rotated for agent: ${id}`);
    return this.agentRepo.save(agent);
  }

  async revoke(id: string): Promise<Agent> {
    const agent = await this.findOne(id);
    agent.status = 'revoked';
    agent.key_revoked_at = new Date();
    this.logger.log(`Agent revoked: ${id}`);
    return this.agentRepo.save(agent);
  }
}
