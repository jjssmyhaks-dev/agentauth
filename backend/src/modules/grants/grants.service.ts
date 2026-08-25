import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grant } from '../../database/entities';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';

@Injectable()
export class GrantsService {
  private readonly logger = new Logger(GrantsService.name);

  constructor(
    @InjectRepository(Grant)
    private grantRepo: Repository<Grant>,
    private tokenService: TokenService,
    private identityService: IdentityService,
  ) {}

  async create(
    agentId: string,
    resourceType: string,
    resourcePattern: string,
    allowedActions: string[],
    createdByUserId: string,
    expiresAt?: Date,
    usageCap?: number,
  ): Promise<Grant> {
    const agent = await this.identityService.findOne(agentId);
    const grant = this.grantRepo.create({
      agent_id: agentId,
      org_id: agent.org_id,
      resource_type: resourceType,
      resource_pattern: resourcePattern,
      allowed_actions: allowedActions,
      created_by_user_id: createdByUserId,
      expires_at: expiresAt,
      usage_cap: usageCap,
      status: 'active',
    });
    this.logger.log(`Grant created: ${resourceType}:${resourcePattern} for agent ${agentId}`);
    return this.grantRepo.save(grant);
  }

  async findByAgent(agentId: string): Promise<Grant[]> {
    return this.grantRepo.find({ where: { agent_id: agentId }, order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<Grant> {
    const grant = await this.grantRepo.findOne({ where: { id } });
    if (!grant) throw new NotFoundException(`Grant ${id} not found`);
    return grant;
  }

  async update(id: string, expiresAt?: Date, usageCap?: number): Promise<Grant> {
    const grant = await this.findOne(id);
    if (grant.status !== 'active') throw new BadRequestException('Can only update active grants');
    if (expiresAt) grant.expires_at = expiresAt;
    if (usageCap !== undefined) grant.usage_cap = usageCap;
    return this.grantRepo.save(grant);
  }

  async revoke(id: string): Promise<Grant> {
    const grant = await this.findOne(id);
    grant.status = 'revoked';
    grant.revoked_at = new Date();
    this.logger.log(`Grant revoked: ${id}`);
    return this.grantRepo.save(grant);
  }

  async checkPermission(
    token: string,
    resourceType: string,
    resourceId: string,
    action: string,
  ): Promise<any> {
    const tokenPayload = await this.tokenService.verifyToken(token);
    if (!tokenPayload.valid) return { allowed: false, reason: 'invalid_token' };

    const agentId = tokenPayload.agent_id;
    const agent = await this.identityService.findOne(agentId);
    if (agent.status === 'revoked') return { allowed: false, reason: 'agent_revoked' };

    // Check if expired tokens are still active
    const grants = await this.grantRepo.find({
      where: { agent_id: agentId, status: 'active' },
    });

    for (const grant of grants) {
      if (grant.resource_type !== resourceType) continue;
      if (!this.resourceMatches(resourceId, grant.resource_pattern)) continue;
      if (!grant.allowed_actions.includes(action)) continue;

      // Check expiry
      if (grant.expires_at && grant.expires_at < new Date()) {
        grant.status = 'expired';
        await this.grantRepo.save(grant);
        continue;
      }

      // Check usage cap
      if (grant.usage_cap && grant.usage_count >= grant.usage_cap) {
        return { allowed: false, matched_grant_id: grant.id, reason: 'usage_cap_reached' };
      }

      // ✓ Permission granted — increment usage count
      await this.grantRepo.increment({ id: grant.id }, 'usage_count', 1);

      const requiresApproval =
        agent.approval_mode_override === 'human_in_the_loop' ||
        tokenPayload.approval_mode === 'human_in_the_loop';

      return {
        allowed: true,
        matched_grant_id: grant.id,
        requires_approval: requiresApproval,
      };
    }

    return { allowed: false, reason: 'no_matching_grant' };
  }

  private resourceMatches(resourceId: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return resourceId.startsWith(pattern.slice(0, -1));
    if (pattern.startsWith('*')) return resourceId.endsWith(pattern.slice(1));
    return resourceId === pattern;
  }
}
