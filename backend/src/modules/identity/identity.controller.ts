import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { IdentityService } from './identity.service';

@Controller('v1/agents')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  async registerAgent(
    @Body() body: { org_id: string; name: string; public_key: string },
  ) {
    const agent = await this.identityService.registerAgent(
      body.org_id,
      body.name,
      body.public_key,
    );
    return {
      agent_id: agent.id,
      status: agent.status,
      created_at: agent.created_at,
    };
  }

  @Get(':agent_id')
  async getAgent(@Param('agent_id') agentId: string) {
    const agent = await this.identityService.getAgent(agentId);
    return {
      id: agent.id,
      name: agent.name,
      org_id: agent.org_id,
      public_key: agent.public_key,
      status: agent.status,
      approval_mode_override: agent.approval_mode_override,
      created_at: agent.created_at,
    };
  }

  @Post(':agent_id/rotate-key')
  async rotateKey(
    @Param('agent_id') agentId: string,
    @Body() body: { new_public_key?: string },
  ) {
    const agent = await this.identityService.rotateKey(agentId, body.new_public_key);
    return {
      agent_id: agent.id,
      rotated_at: agent.key_rotated_at,
    };
  }

  @Post(':agent_id/revoke')
  async revokeAgent(@Param('agent_id') agentId: string) {
    const agent = await this.identityService.revokeAgent(agentId);
    return {
      agent_id: agent.id,
      status: agent.status,
      revoked_at: agent.key_revoked_at,
    };
  }

  @Get()
  async listAgents(@Query('org_id') orgId: string) {
    return this.identityService.getAgentsByOrg(orgId);
  }
}
