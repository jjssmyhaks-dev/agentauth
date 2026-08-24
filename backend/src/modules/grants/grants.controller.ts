import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { GrantsService } from './grants.service';

@Controller('v1')
export class GrantsController {
  constructor(private readonly grantsService: GrantsService) {}

  @Post('grants')
  async createGrant(
    @Body() body: {
      agent_id: string;
      resource_type: string;
      resource_pattern: string;
      allowed_actions: string[];
      expires_at?: string;
      usage_cap?: number;
      created_by_user_id: string;
    },
  ) {
    const grant = await this.grantsService.createGrant(
      body.agent_id,
      body.resource_type,
      body.resource_pattern,
      body.allowed_actions,
      body.created_by_user_id,
      body.expires_at ? new Date(body.expires_at) : undefined,
      body.usage_cap,
    );

    return {
      grant_id: grant.id,
      status: grant.status,
      created_at: grant.created_at,
    };
  }

  @Get('grants')
  async listGrants(@Query('agent_id') agentId: string) {
    return this.grantsService.getGrantsByAgent(agentId);
  }

  @Patch('grants/:grant_id')
  async updateGrant(
    @Param('grant_id') grantId: string,
    @Body() body: { expires_at?: string; usage_cap?: number },
  ) {
    const grant = await this.grantsService.updateGrant(
      grantId,
      body.expires_at ? new Date(body.expires_at) : undefined,
      body.usage_cap,
    );

    return {
      grant_id: grant.id,
      status: grant.status,
      expires_at: grant.expires_at,
      usage_cap: grant.usage_cap,
    };
  }

  @Delete('grants/:grant_id')
  async revokeGrant(@Param('grant_id') grantId: string) {
    const grant = await this.grantsService.revokeGrant(grantId);
    return {
      grant_id: grant.id,
      status: grant.status,
      revoked_at: grant.revoked_at,
    };
  }

  @Post('permissions/check')
  async checkPermission(
    @Body() body: {
      token: string;
      resource_type: string;
      resource_id: string;
      action: string;
    },
  ) {
    return this.grantsService.checkPermission(
      body.token,
      body.resource_type,
      body.resource_id,
      body.action,
    );
  }
}
