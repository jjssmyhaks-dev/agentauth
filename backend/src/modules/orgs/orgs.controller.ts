import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../database/entities';
import { UpdateOrgSettingsDto } from '../../common/dto';

@ApiTags('Organizations')
@Controller('v1/orgs')
export class OrgsController {
  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  async findOne(@Param('id') id: string) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) return { error: 'Not found' };
    return org;
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update org settings' })
  async updateSettings(@Param('id') id: string, @Body() dto: UpdateOrgSettingsDto) {
    let org = await this.orgRepo.findOne({ where: { id } });
    if (!org) {
      org = this.orgRepo.create({ id, name: dto.name || 'New Org' });
    }
    if (dto.name) org.name = dto.name;
    if (dto.default_approval_mode) org.default_approval_mode = dto.default_approval_mode as any;
    if (dto.action_overrides) org.action_overrides = dto.action_overrides;
    if (dto.token_ttl_minutes || dto.ip_allowlist) {
      org.settings = {
        ...org.settings,
        token_ttl_minutes: dto.token_ttl_minutes,
        ip_allowlist: dto.ip_allowlist,
      };
    }
    return this.orgRepo.save(org);
  }

  @Patch(':id/approval-policy')
  @ApiOperation({ summary: 'Update approval policy for org' })
  async updateApprovalPolicy(
    @Param('id') id: string,
    @Body() body: { default_mode: string; action_overrides?: Record<string, string> },
  ) {
    let org = await this.orgRepo.findOne({ where: { id } });
    if (!org) {
      org = this.orgRepo.create({ id, name: 'Org' });
    }
    org.default_approval_mode = body.default_mode as any;
    if (body.action_overrides) org.action_overrides = body.action_overrides;
    return this.orgRepo.save(org);
  }
}
