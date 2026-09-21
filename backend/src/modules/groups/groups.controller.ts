import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { orgFrom } from '../policies/policies-org.helper';

export class CreateGroupDto {
  @ApiProperty() @IsUUID() org_id: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateGroupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class SetMembersDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('all', { each: true }) agent_ids: string[];
}

@ApiTags('Groups')
@Controller('v1/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an agent group (org from the bearer key)' })
  async create(@Req() request: any, @Body() dto: CreateGroupDto) {
    const group = await this.groupsService.create(orgFrom(request, dto.org_id), dto.name, dto.description);
    return { group_id: group.id, name: group.name, status: 'created' };
  }

  @Get()
  @ApiOperation({ summary: 'List agent groups (with members) for the resolved org' })
  async findAll(@Req() request: any, @Query('org_id') orgId: string) {
    const groups = await this.groupsService.findByOrg(orgFrom(request, orgId));
    return groups.map((g) => ({
      id: g.id,
      org_id: g.org_id,
      name: g.name,
      description: g.description,
      member_ids: (g.members ?? []).map((a) => a.id),
      member_count: (g.members ?? []).length,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a group' })
  async update(@Param('id') id: string, @Req() request: any, @Query('org_id') orgId: string, @Body() dto: UpdateGroupDto) {
    const group = await this.groupsService.update(orgFrom(request, orgId), id, dto);
    return { group_id: group.id, name: group.name, status: 'updated' };
  }

  @Put(':id/members')
  @ApiOperation({ summary: 'Replace the membership of a group' })
  async setMembers(@Param('id') id: string, @Req() request: any, @Query('org_id') orgId: string, @Body() dto: SetMembersDto) {
    const group = await this.groupsService.setMembers(orgFrom(request, orgId), id, dto.agent_ids);
    return { group_id: group.id, member_count: group.members?.length ?? 0, status: 'updated' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a group' })
  async remove(@Param('id') id: string, @Req() request: any, @Query('org_id') orgId: string) {
    await this.groupsService.remove(orgFrom(request, orgId), id);
    return { deleted: true };
  }
}
