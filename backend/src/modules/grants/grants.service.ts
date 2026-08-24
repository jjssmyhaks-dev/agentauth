import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Grant } from '../../database/entities';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';

@Injectable()
export class GrantsService {
  constructor(
    @InjectRepository(Grant)
    private grantRepository: Repository<Grant>,
    private tokenService: TokenService,
    private identityService: IdentityService,
  ) {}

  async createGrant(
    agentId: string,
    resourceType: string,
    resourcePattern: string,
    allowedActions: string[],
    createdByUserId: string,
    expiresAt?: Date,
    usageCap?: number,
  ): Promise<Grant> {
    const agent = await this.identityService.getAgent(agentId);
    
    const grant = this.grantRepository.create({
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

    return this.grantRepository.save(grant);
  }

  async getGrantsByAgent(agentId: string): Promise<Grant[]> {
    return this.grantRepository.find({
      where: { agent_id: agentId },
      order: { created_at: 'DESC' },
    });
  }

  async getGrant(grantId: string): Promise<Grant> {
    const grant = await this.grantRepository.findOne({ where: { id: grantId } });
    if (!grant) {
      throw new NotFoundException('Grant not found');
    }
    return grant;
  }

  async updateGrant(
    grantId: string,
    expiresAt?: Date,
    usageCap?: number,
  ): Promise<Grant> {
    const grant = await this.getGrant(grantId);
    
    if (grant.status !== 'active') {
      throw new BadRequestException('Can only update active grants');
    }

    if (expiresAt) {
      grant.expires_at = expiresAt;
    }
    if (usageCap !== undefined) {
      grant.usage_cap = usageCap;
    }

    return this.grantRepository.save(grant);
  }

  async revokeGrant(grantId: string): Promise<Grant> {
    const grant = await this.getGrant(grantId);
    
    grant.status = 'revoked';
    grant.revoked_at = new Date();

    return this.grantRepository.save(grant);
  }

  async checkPermission(
    token: string,
    resourceType: string,
    resourceId: string,
    action: string,
  ): Promise<any> {
    // Verify token
    const tokenPayload = await this.tokenService.verifyToken(token);
    if (!tokenPayload.valid) {
      return { allowed: false, reason: 'invalid_token' };
    }

    const agentId = tokenPayload.agent_id;

    // Get agent and check status
    const agent = await this.identityService.getAgent(agentId);
    if (agent.status === 'revoked') {
      return { allowed: false, reason: 'agent_revoked' };
    }

    // Get active grants for this agent
    const grants = await this.grantRepository.find({
      where: {
        agent_id: agentId,
        status: 'active',
      },
    });

    // Find matching grant
    for (const grant of grants) {
      // Check if resource matches pattern
      if (this.resourceMatches(resourceId, grant.resource_pattern) &&
          grant.resource_type === resourceType &&
          grant.allowed_actions.includes(action)) {
        
        // Check expiry
        if (grant.expires_at && grant.expires_at < new Date()) {
          continue;
        }

        // Check usage cap
        if (grant.usage_cap && grant.usage_count >= grant.usage_cap) {
          return {
            allowed: false,
            matched_grant_id: grant.id,
            reason: 'usage_cap_reached',
          };
        }

        // Check if approval required
        const requiresApproval = 
          agent.approval_mode_override === 'human_in_the_loop' ||
          (tokenPayload.scopes?.approval_mode === 'human_in_the_loop');

        return {
          allowed: true,
          matched_grant_id: grant.id,
          requires_approval: requiresApproval,
        };
      }
    }

    return { allowed: false, reason: 'no_matching_grant' };
  }

  private resourceMatches(resourceId: string, pattern: string): boolean {
    // Simple wildcard matching
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return resourceId.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return resourceId.endsWith(pattern.slice(1));
    }
    return resourceId === pattern;
  }

  async incrementUsage(grantId: string): Promise<void> {
    await this.grantRepository.increment({ id: grantId }, 'usage_count', 1);
  }
}
