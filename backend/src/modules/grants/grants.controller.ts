import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GrantsService } from './grants.service';
import { CreateGrantDto, UpdateGrantDto, PermissionCheckDto } from '../../common/dto';

@ApiTags('Grants')
@Controller('v1')
export class GrantsController {
  constructor(private readonly grantsService: GrantsService) {}

  @Post('grants')
  @ApiOperation({ summary: 'Create a permission grant' })
  async createGrant(@Body() dto: CreateGrantDto) {
    const grant = await this.grantsService.create(
      dto.agent_id, dto.resource_type, dto.resource_pattern,
      dto.allowed_actions, '', // created_by_user_id (from auth middleware)
      dto.expires_at ? new Date(dto.expires_at) : undefined,
      dto.usage_cap,
    );
    return { grant_id: grant.id, status: grant.status, created_at: grant.created_at };
  }

  @Get('grants')
  @ApiOperation({ summary: 'List grants for an agent' })
  async listGrants(@Query('agent_id') agentId: string) {
    return this.grantsService.findByAgent(agentId);
  }

  @Patch('grants/:grant_id')
  @ApiOperation({ summary: 'Update grant expiry or usage cap' })
  async updateGrant(@Param('grant_id') grantId: string, @Body() dto: UpdateGrantDto) {
    const grant = await this.grantsService.update(
      grantId, dto.expires_at ? new Date(dto.expires_at) : undefined, dto.usage_cap,
    );
    return { grant_id: grant.id, status: grant.status, expires_at: grant.expires_at, usage_cap: grant.usage_cap };
  }

  @Delete('grants/:grant_id')
  @ApiOperation({ summary: 'Revoke a grant' })
  async revokeGrant(@Param('grant_id') grantId: string) {
    const grant = await this.grantsService.revoke(grantId);
    return { grant_id: grant.id, status: grant.status, revoked_at: grant.revoked_at };
  }

  @Post('permissions/check')
  @ApiOperation({ summary: 'Check if agent has permission for action' })
  async checkPermission(@Body() dto: PermissionCheckDto) {
    return this.grantsService.checkPermission(dto.token, dto.resource_type, dto.resource_id, dto.action);
  }
}
