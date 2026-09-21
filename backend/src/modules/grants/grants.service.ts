import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grant } from '../../database/entities';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';
import { PolicyEngineService, PolicyContext } from '../policies/policy-engine.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class GrantsService {
  private readonly logger = new Logger(GrantsService.name);

  constructor(
    @InjectRepository(Grant)
    private grantRepo: Repository<Grant>,
    private tokenService: TokenService,
    private identityService: IdentityService,
    private policyEngine: PolicyEngineService,
    private auditService: AuditService,
  ) {}

  async create(
    agentId: string,
    resourceType: string,
    resourcePattern: string,
    allowedActions: string[],
    createdByUserId?: string,
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
        await this.auditCheck(agent, resourceType, resourceId, action, grant.id, 'denied', 'usage_cap_reached');
        return { allowed: false, matched_grant_id: grant.id, reason: 'usage_cap_reached' };
      }

      // ✓ Grant matched. Now the policy layer decides HOW it is allowed.
      // Policies never grant — they can only restrict or gate a matched grant
      // (deny / require_approval / step_up / contextual allow rules).
      const policyCtx: PolicyContext = {
        trigger: 'permission_check',
        agent_id: agentId,
        org_id: agent.org_id,
        resource_type: resourceType,
        resource_id: resourceId,
        action,
        session_mismatch: false,
        new_environment: false,
        off_hours: this.isOffHours(),
        current_hour: new Date().getUTCHours(),
        // Caller-supplied sensitivity/trust ride on the token payload when present.
        resource_sensitivity: tokenPayload.resource_sensitivity,
        current_trust_level: tokenPayload.trust_level,
      };
      const policyResult = await this.policyEngine.evaluate(policyCtx);

      if (policyResult.matched && policyResult.action === 'deny') {
        await this.auditCheck(agent, resourceType, resourceId, action, grant.id, 'denied', `policy:${policyResult.policy_id}`);
        return {
          allowed: false,
          matched_grant_id: grant.id,
          matched_policy_id: policyResult.policy_id,
          reason: 'policy_denied',
          policy_reason: policyResult.reason,
        };
      }

      if (policyResult.matched && policyResult.action === 'step_up') {
        await this.auditCheck(agent, resourceType, resourceId, action, grant.id, 'denied', `step_up:${policyResult.policy_id}`);
        return {
          allowed: false,
          matched_grant_id: grant.id,
          matched_policy_id: policyResult.policy_id,
          reason: 'step_up_required',
          policy_reason: policyResult.reason,
        };
      }

      await this.grantRepo.increment({ id: grant.id }, 'usage_count', 1);

      const requiresApproval =
        (policyResult.matched && policyResult.action === 'require_approval') ||
        agent.approval_mode_override === 'human_in_the_loop' ||
        tokenPayload.approval_mode === 'human_in_the_loop';

      await this.auditCheck(
        agent, resourceType, resourceId, action, grant.id, 'allowed',
        policyResult.matched ? `policy:${policyResult.policy_id}` : undefined,
      );
      return {
        allowed: true,
        matched_grant_id: grant.id,
        matched_policy_id: policyResult.matched ? policyResult.policy_id : undefined,
        requires_approval: requiresApproval,
      };
    }

    await this.auditCheck(agent, resourceType, resourceId, action, undefined, 'denied', 'no_matching_grant');
    return { allowed: false, reason: 'no_matching_grant' };
  }

  /** Audit a permission decision (best-effort: a failed audit write must not
   *  break the authorization response). */
  private async auditCheck(
    agent: { org_id: string; id: string },
    resourceType: string,
    resourceId: string,
    action: string,
    grantId: string | undefined,
    result: 'allowed' | 'denied',
    reason?: string,
  ): Promise<void> {
    try {
      await this.auditService.logEntry(
        agent.org_id,
        'agent',
        agent.id,
        'permission.check',
        `${resourceType}:${resourceId}${action ? `#${action}` : ''}`,
        result,
      );
    } catch (err) {
      this.logger.warn(`Failed to audit permission check: ${err}`);
    }
  }

  /** Off-hours heuristic: outside 08:00–18:00 UTC ( Mon–Fri respected by the
   *  off_hours policy author, not enforced here). */
  private isOffHours(): boolean {
    const hour = new Date().getUTCHours();
    return hour < 8 || hour >= 18;
  }

  private resourceMatches(resourceId: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return resourceId.startsWith(pattern.slice(0, -1));
    if (pattern.startsWith('*')) return resourceId.endsWith(pattern.slice(1));
    return resourceId === pattern;
  }
}
