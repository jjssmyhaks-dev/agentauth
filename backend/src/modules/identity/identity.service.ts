import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Agent } from '../../database/entities';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  async registerAgent(orgId: string, name: string, publicKey: string): Promise<Agent> {
    const agent = this.agentRepository.create({
      org_id: orgId,
      name,
      public_key: publicKey,
      status: 'active',
    });
    return this.agentRepository.save(agent);
  }

  async getAgent(agentId: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async rotateKey(agentId: string, newPublicKey?: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    
    if (agent.status === 'revoked') {
      throw new BadRequestException('Cannot rotate key for revoked agent');
    }

    agent.key_rotated_at = new Date();
    if (newPublicKey) {
      agent.public_key = newPublicKey;
    }
    
    return this.agentRepository.save(agent);
  }

  async revokeAgent(agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    
    agent.status = 'revoked';
    agent.key_revoked_at = new Date();
    
    return this.agentRepository.save(agent);
  }

  async getAgentsByOrg(orgId: string): Promise<Agent[]> {
    return this.agentRepository.find({ where: { org_id: orgId } });
  }

  async isAgentActive(agentId: string): Promise<boolean> {
    const agent = await this.getAgent(agentId);
    return agent.status === 'active';
  }
}
