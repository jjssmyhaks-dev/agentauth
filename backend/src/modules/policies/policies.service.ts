import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../../database/entities';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepo: Repository<Policy>,
  ) {}

  async create(
    orgId: string,
    scope: string,
    scopeTargetId: string | null,
    trigger: string,
    condition: Record<string, any>,
    action: string,
    priority: number,
    description?: string,
  ): Promise<Policy> {
    if (!['org', 'agent', 'agent_group'].includes(scope)) {
      throw new BadRequestException('Invalid scope');
    }
    if (!['new_environment', 'trust_below_threshold', 'session_mismatch', 'off_hours', 'resource_sensitivity_high'].includes(trigger)) {
      throw new BadRequestException('Invalid trigger');
    }
    if (!['allow', 'require_approval', 'step_up', 'deny'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }

    const policy = new Policy();
    policy.org_id = orgId;
    policy.scope = scope as 'org' | 'agent' | 'agent_group';
    policy.scope_target_id = scopeTargetId ?? null;
    policy.trigger = trigger;
    policy.condition = condition;
    policy.action = action as 'allow' | 'require_approval' | 'step_up' | 'deny';
    policy.priority = priority;
    policy.description = description ?? '';
    policy.enabled = true;

    this.logger.log(`Policy created: ${trigger} → ${action} for org ${orgId}`);
    return this.policyRepo.save(policy);
  }

  async findAll(orgId: string): Promise<Policy[]> {
    const policies = await this.policyRepo.find({
      where: { org_id: orgId },
      order: { priority: 'DESC', created_at: 'DESC' },
    });
    return policies;
  }

  async findOne(id: string): Promise<Policy> {
    const policy = await this.policyRepo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException(`Policy ${id} not found`);
    return policy;
  }

  async update(
    id: string,
    updates: Partial<{
      scope: string;
      scope_target_id: string;
      trigger: string;
      condition: Record<string, any>;
      action: string;
      priority: number;
      enabled: boolean;
      description: string;
    }>,
  ): Promise<Policy> {
    const policy = await this.findOne(id);
    Object.assign(policy, updates);
    this.logger.log(`Policy updated: ${id}`);
    return this.policyRepo.save(policy);
  }

  async remove(id: string): Promise<void> {
    const policy = await this.findOne(id);
    await this.policyRepo.remove(policy);
    this.logger.log(`Policy deleted: ${id}`);
  }
}
