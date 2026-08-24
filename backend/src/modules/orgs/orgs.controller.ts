import { Controller, Patch, Param, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../database/entities';

@Controller('v1/orgs')
export class OrgsController {
  constructor(
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
  ) {}

  @Patch(':org_id/settings')
  async updateSettings(
    @Param('org_id') orgId: string,
    @Body() body: {
      default_approval_mode?: 'autonomous' | 'human_in_the_loop';
      token_ttl?: number;
      ip_allowlist?: string;
    },
  ) {
    const org = await this.orgRepository.findOne({ where: { id: orgId } });
    if (!org) {
      throw new Error('Organization not found');
    }

    if (body.default_approval_mode) {
      org.default_approval_mode = body.default_approval_mode;
    }

    await this.orgRepository.save(org);

    return {
      org_id: org.id,
      default_approval_mode: org.default_approval_mode,
      settings_updated: true,
    };
  }
}
