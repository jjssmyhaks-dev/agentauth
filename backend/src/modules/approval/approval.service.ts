import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingApproval, Agent, Organization } from '../../database/entities';
import { AuditService } from '../audit/audit.service';
import { IdentityService } from '../identity/identity.service';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(PendingApproval)
    private approvalRepo: Repository<PendingApproval>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    private auditService: AuditService,
    private identityService: IdentityService,
  ) {}

  async create(agentId: string, action: string, resource: string, context?: any): Promise<PendingApproval> {
    // Look up agent to get org_id for audit
    const agent = await this.identityService.findOne(agentId);

    const approval = this.approvalRepo.create({
      agent_id: agentId,
      action,
      resource,
      context,
      status: 'pending',
    });
    const saved = await this.approvalRepo.save(approval);

    // FIX: pass actual org_id, not empty string
    await this.auditService.logEntry(
      agent.org_id,
      'agent',
      agentId,
      'approval.requested',
      resource,
      'pending',
    );

    // Optionally send Knock notification (fire-and-forget)
    this.sendApprovalNotification(saved, agent).catch(() => {});

    this.logger.log(`Approval requested: ${action} on ${resource} by agent ${agentId}`);
    return saved;
  }

  async findAll(orgId: string, status?: string): Promise<PendingApproval[]> {
    const qb = this.approvalRepo.createQueryBuilder('approval')
      .innerJoinAndSelect('approval.agent', 'agent')
      .where('agent.org_id = :orgId', { orgId });
    if (status) qb.andWhere('approval.status = :status', { status });
    return qb.orderBy('approval.requested_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<PendingApproval> {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) throw new NotFoundException(`Approval ${id} not found`);
    return approval;
  }

  async decide(
    id: string,
    decision: 'approve' | 'deny',
    decidedByUserId: string,
    reason?: string,
  ): Promise<PendingApproval> {
    const approval = await this.findOne(id);
    if (approval.status !== 'pending') throw new BadRequestException('Approval already decided');

    approval.decision = decision === 'approve' ? 'approved' : 'denied';
    approval.status = approval.decision;
    approval.decided_by_user_id = decidedByUserId;
    approval.decided_at = new Date();
    approval.reason = reason || '';
    const saved = await this.approvalRepo.save(approval);

    // Get agent for org_id
    const agent = await this.identityService.findOne(approval.agent_id);
    await this.auditService.logEntry(
      agent.org_id,
      'user',
      decidedByUserId,
      `approval.${decision}`,
      approval.resource,
      decision === 'approve' ? 'allowed' : 'denied',
    );

    this.logger.log(`Approval ${decision}: ${id} by user ${decidedByUserId}`);
    return saved;
  }

  async getOrgPolicy(orgId: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return org;
  }

  async updateOrgPolicy(
    orgId: string,
    defaultMode: 'autonomous' | 'human_in_the_loop',
    actionOverrides?: Record<string, string>,
  ): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    org.default_approval_mode = defaultMode;
    if (actionOverrides) org.action_overrides = actionOverrides;
    return this.orgRepo.save(org);
  }

  private async sendApprovalNotification(approval: PendingApproval, agent: Agent): Promise<void> {
    const knockKey = process.env.KNOCK_API_KEY;
    if (!knockKey) return; // Skip if Knock not configured
    // In production, use the Knock SDK to send approval notifications
    // This is a placeholder for the integration
    this.logger.debug(`Would send Knock notification for approval ${approval.id}`);
  }
}
