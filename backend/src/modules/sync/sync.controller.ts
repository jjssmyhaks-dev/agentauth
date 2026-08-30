import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SyncService, SyncAgentPayload } from './sync.service';
import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSyncSourceDto {
  @ApiProperty() @IsUUID() org_id: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ default: 'generic' }) @IsString() type: string;
  @ApiPropertyOptional() config?: Record<string, any>;
}

export class WebhookPayloadDto {
  @ApiProperty({ type: [Object] }) @IsArray() agents: SyncAgentPayload[];
}

@ApiTags('Directory Sync')
@Controller('v1/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('sources')
  @ApiOperation({ summary: 'Create a sync source (connector)' })
  async createSource(@Body() dto: CreateSyncSourceDto) {
    const source = await this.syncService.createSource(dto.org_id, dto.name, dto.type, dto.config || {});
    return { source_id: source.id, name: source.name };
  }

  @Get('sources')
  @ApiOperation({ summary: 'List all sync sources for an org' })
  async getSources(@Param() params: any, @Body() body: any) {
    // org_id from query or body
    const orgId = body?.org_id || '';
    return this.syncService.getSources(orgId);
  }

  @Get('sources/:id')
  @ApiOperation({ summary: 'Get sync source details' })
  async getSource(@Param('id') id: string) {
    return this.syncService.getSource(id);
  }

  @Post('sources/:id/trigger')
  @ApiOperation({ summary: 'Trigger a sync for a source' })
  async triggerSync(@Param('id') id: string) {
    return this.syncService.triggerSync(id);
  }

  @Get('sources/:id/status')
  @ApiOperation({ summary: 'Get sync job history for a source' })
  async getStatus(@Param('id') id: string) {
    return this.syncService.getJobsForSource(id);
  }

  @Get('sources/:id/jobs/:jobId')
  @ApiOperation({ summary: 'Get a specific sync job status' })
  async getJobStatus(@Param('id') id: string, @Param('jobId') jobId: string) {
    return this.syncService.getJobStatus(jobId);
  }

  @Post('webhook/:sourceId')
  @ApiOperation({ summary: 'Webhook endpoint to push agent metadata' })
  async handleWebhook(@Param('sourceId') sourceId: string, @Body() dto: WebhookPayloadDto) {
    return this.syncService.handleWebhook(sourceId, dto.agents);
  }
}
