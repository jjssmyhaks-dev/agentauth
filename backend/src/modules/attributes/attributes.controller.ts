import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AttributesService } from './attributes.service';
import { IsString, IsOptional, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetAttributesDto {
  @ApiProperty({ type: [{ key: String, value: String }] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeItemDto)
  attributes: AttributeItemDto[];
}

export class AttributeItemDto {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() value: string;
}

export class CreateGroupDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() filter?: Record<string, any>;
}

@ApiTags('Attributes')
@Controller('v1')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  // ── Agent Attributes ──

  @Get('agents/:agentId/attributes')
  @ApiOperation({ summary: 'Get custom attributes for an agent' })
  async getAttributes(@Param('agentId') agentId: string) {
    return this.attributesService.getAttributes(agentId);
  }

  @Put('agents/:agentId/attributes')
  @ApiOperation({ summary: 'Set/update custom attributes for an agent' })
  async setAttributes(@Param('agentId') agentId: string, @Body() dto: SetAttributesDto) {
    return this.attributesService.setAttributes(agentId, dto.attributes);
  }

  @Delete('agents/:agentId/attributes/:key')
  @ApiOperation({ summary: 'Delete a custom attribute' })
  async deleteAttribute(@Param('agentId') agentId: string, @Param('key') key: string) {
    await this.attributesService.deleteAttribute(agentId, key);
    return { deleted: true };
  }

  // ── Groups ──

  @Get('groups')
  @ApiOperation({ summary: 'List all agent groups for an org' })
  async getGroups(@Query('org_id') orgId: string) {
    return this.attributesService.getGroups(orgId);
  }

  @Post('groups')
  @ApiOperation({ summary: 'Create an agent group' })
  async createGroup(@Body() dto: CreateGroupDto & { org_id: string }) {
    const group = await this.attributesService.createGroup(dto.org_id, dto.name, dto.description, dto.filter);
    return { group_id: group.id, name: group.name };
  }

  @Get('groups/:id')
  @ApiOperation({ summary: 'Get group details with members' })
  async getGroup(@Param('id') id: string) {
    return this.attributesService.getGroup(id);
  }

  @Put('groups/:id')
  @ApiOperation({ summary: 'Update a group' })
  async updateGroup(@Param('id') id: string, @Body() dto: Partial<CreateGroupDto>) {
    return this.attributesService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @ApiOperation({ summary: 'Delete a group' })
  async deleteGroup(@Param('id') id: string) {
    await this.attributesService.deleteGroup(id);
    return { deleted: true };
  }

  @Post('groups/:id/members/:agentId')
  @ApiOperation({ summary: 'Add agent to group' })
  async addMember(@Param('id') groupId: string, @Param('agentId') agentId: string) {
    return this.attributesService.addMember(groupId, agentId);
  }

  @Delete('groups/:id/members/:agentId')
  @ApiOperation({ summary: 'Remove agent from group' })
  async removeMember(@Param('id') groupId: string, @Param('agentId') agentId: string) {
    return this.attributesService.removeMember(groupId, agentId);
  }
}
