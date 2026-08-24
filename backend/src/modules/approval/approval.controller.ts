import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller('v1')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('approvals')
  async createApproval(
    @Body() body: {
      agent_id: string;
      action: string;
      resource: string;
      context?: any;
    },
  ) {
    const approval = await this.approvalService.createApproval(
      body.agent_id,
      body.action,
      body.resource,
      body.context,
    );

    return {
      approval_id: approval.id,
      status: approval.status,
      requested_at: approval.requested_at,
    };
  }

  @Get('approvals')
  async listApprovals(
    @Query('org_id') orgId: string,
    @Query('status') status?: string,
  ) {
    return this.approvalService.getApprovals(orgId, status);
  }

  @Get('approvals/:approval_id')
  async getApproval(@Param('approval_id') approvalId: string) {
    return this.approvalService.getApproval(approvalId);
  }

  @Post('approvals/:approval_id/decide')
  async decideApproval(
    @Param('approval_id') approvalId: string,
    @Body() body: {
      decision: 'approve' | 'deny';
      decided_by_user_id: string;
      reason?: string;
    },
  ) {
    const approval = await this.approvalService.decideApproval(
      approvalId,
      body.decision,
      body.decided_by_user_id,
      body.reason,
    );

    return {
      approval_id: approval.id,
      status: approval.status,
      decided_at: approval.decided_at,
    };
  }

  @Patch('orgs/:org_id/approval-policy')
  async updateApprovalPolicy(
    @Param('org_id') orgId: string,
    @Body() body: {
      default_mode: 'autonomous' | 'human_in_the_loop';
      action_overrides?: Record<string, string>;
    },
  ) {
    const org = await this.approvalService.updateOrgApprovalPolicy(
      orgId,
      body.default_mode,
      body.action_overrides,
    );

    return {
      org_id: org.id,
      default_approval_mode: org.default_approval_mode,
    };
  }
}
