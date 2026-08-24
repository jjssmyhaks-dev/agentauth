import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingApproval, Organization } from '../../database/entities';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(PendingApproval)
    private approvalRepository: Repository<PendingApproval>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    private auditService: AuditService,
  ) {}

  async createApproval(
    agentId: string,
    action: string,
    resource: string,
    context?: any,
  ): Promise<PendingApproval> {
    const approval = this.approvalRepository.create({
      agent_id: agentId,
      action,
      resource,
      context,
      status: 'pending',
    });

    const saved = await this.approvalRepository.save(approval);

    // Log to audit
    await this.auditService.logEntry(
      '', // org_id will be derived from agent
      'agent',
      agentId,
      'approval.requested',
      resource,
      'pending',
    );

    return saved;
  }

  async getApprovals(
    orgId: string,
    status?: string,
  ): Promise<PendingApproval[]> {
    const query = this.approvalRepository.createQueryBuilder('approval')
      .innerJoin('approval.agent', 'agent')
      .where('agent.org_id = :orgId', { orgId });

    if (status) {
      query.andWhere('approval.status = :status', { status });
    }

    return query.orderBy('approval.requested_at', 'DESC').getMany();
  }

  async getApproval(approvalId: string): Promise<PendingApproval> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    return approval;
  }

  async decideApproval(
    approvalId: string,
    decision: 'approve' | 'deny',
    decidedByUserId: string,
    reason?: string,
  ): Promise<PendingApproval> {
    const approval = await this.getApproval(approvalId);

    if (approval.status !== 'pending') {
      throw new BadRequestException('Approval already decided');
    }

    approval.decision = decision === 'approve' ? 'approved' : 'denied';
    approval.decided_by_user_id = decidedByUserId;
    approval.decided_at = new Date();
    approval.reason = reason || '';
    approval.status = decision === 'approve' ? 'approved' : 'denied';

    const saved = await this.approvalRepository.save(approval);

    // Log to audit
    await this.auditService.logEntry(
      '', // org_id will be derived from agent
      'user',
      decidedByUserId,
      `approval.${decision}`,
      approval.resource,
      decision === 'approve' ? 'allowed' : 'denied',
    );

    return saved;
  }

  async getOrgApprovalPolicy(orgId: string): Promise<Organization> {
    const org = await this.orgRepository.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async updateOrgApprovalPolicy(
    orgId: string,
    defaultMode: 'autonomous' | 'human_in_the_loop',
    actionOverrides?: Record<string, string>,
  ): Promise<Organization> {
    const org = await this.orgRepository.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    org.default_approval_mode = defaultMode;
    return this.orgRepository.save(org);
  }
}
