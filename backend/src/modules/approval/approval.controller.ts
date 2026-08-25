import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { CreateApprovalDto, DecideApprovalDto } from '../../common/dto';

@ApiTags('Approvals')
@Controller('v1')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('approvals')
  @ApiOperation({ summary: 'Create a pending approval request' })
  async create(@Body() dto: CreateApprovalDto) {
    const approval = await this.approvalService.create(dto.agent_id, dto.action, dto.resource, dto.context);
    return { approval_id: approval.id, status: approval.status, requested_at: approval.requested_at };
  }

  @Get('approvals')
  @ApiOperation({ summary: 'List approvals for an org' })
  async findAll(@Query('org_id') orgId: string, @Query('status') status?: string) {
    return this.approvalService.findAll(orgId, status);
  }

  @Get('approvals/:id')
  @ApiOperation({ summary: 'Get approval details (for polling)' })
  async findOne(@Param('id') id: string) {
    return this.approvalService.findOne(id);
  }

  @Post('approvals/:id/decide')
  @ApiOperation({ summary: 'Approve or deny a pending request' })
  async decide(@Param('id') id: string, @Body() dto: DecideApprovalDto) {
    const approval = await this.approvalService.decide(id, dto.decision, dto.decided_by_user_id, dto.reason);
    return { approval_id: approval.id, status: approval.status, decided_at: approval.decided_at };
  }

  @Patch('orgs/:org_id/approval-policy')
  @ApiOperation({ summary: 'Update org approval policy' })
  async updatePolicy(
    @Param('org_id') orgId: string,
    @Body() body: { default_mode: 'autonomous' | 'human_in_the_loop'; action_overrides?: Record<string, string> },
  ) {
    const org = await this.approvalService.updateOrgPolicy(orgId, body.default_mode, body.action_overrides);
    return { org_id: org.id, default_approval_mode: org.default_approval_mode };
  }
}
