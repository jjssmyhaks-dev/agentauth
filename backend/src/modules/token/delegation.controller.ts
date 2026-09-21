import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DelegationService, Scope } from './delegation.service';
import { AUTH_REQUEST_KEY } from '../../modules/auth/api-key.guard';

class ScopeDto implements Scope {
  @IsString()
  resource_type: string;

  @IsString()
  resource_pattern: string;

  @IsArray()
  @IsString({ each: true })
  allowed_actions: string[];
}

export class MintDelegationDto {
  @IsUUID()
  child_agent_id: string;

  @IsString()
  parent_token: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScopeDto)
  scopes: ScopeDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  ttl_minutes?: number;

  @IsOptional()
  @IsString()
  purpose?: string;
}

export class RevokeDelegationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Delegation')
@Controller('v1/delegation')
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Post()
  @ApiOperation({
    summary: 'Mint a delegated token for a sub-agent (parent token authorizes the mint)',
  })
  async mint(@Req() req: any, @Body() dto: MintDelegationDto) {
    return this.delegationService.mint(
      dto.parent_token,
      dto.child_agent_id,
      dto.scopes as Scope[],
      { ttlMinutes: dto.ttl_minutes, purpose: dto.purpose },
    );
  }

  @Get()
  @ApiOperation({ summary: 'List delegation chains for the org' })
  async list(@Req() req: any) {
    return this.delegationService.listForOrg(req[AUTH_REQUEST_KEY].org_id);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke a delegation link (and its child token)' })
  async revoke(@Req() req: any, @Param('id') id: string, @Body() dto: RevokeDelegationDto) {
    await this.delegationService.revoke(id, req[AUTH_REQUEST_KEY].org_id, dto.reason);
    return { revoked: true, id };
  }
}
