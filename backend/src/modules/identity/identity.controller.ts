import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { RegisterAgentDto, RotateKeyDto } from '../../common/dto';

@ApiTags('Identity')
@Controller('v1/agents')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new agent' })
  async register(@Body() dto: RegisterAgentDto) {
    const agent = await this.identityService.register(dto.org_id, dto.name, dto.public_key);
    return { agent_id: agent.id, status: agent.status, created_at: agent.created_at };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details' })
  async findOne(@Param('id') id: string) {
    return this.identityService.findOne(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all agents for an org' })
  async findAll(@Query('org_id') orgId: string) {
    return this.identityService.findAllByOrg(orgId);
  }

  @Post(':id/rotate-key')
  @ApiOperation({ summary: 'Rotate agent key pair' })
  async rotateKey(@Param('id') id: string, @Body() dto: RotateKeyDto) {
    const agent = await this.identityService.rotateKey(id, dto.new_public_key);
    return { agent_id: agent.id, rotated_at: agent.key_rotated_at };
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke agent identity' })
  async revoke(@Param('id') id: string) {
    const agent = await this.identityService.revoke(id);
    return { agent_id: agent.id, status: agent.status, revoked_at: agent.key_revoked_at };
  }
}
