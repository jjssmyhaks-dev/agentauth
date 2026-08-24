import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from './audit.service';

@Controller('v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('log')
  async logEntry(
    @Body() body: {
      org_id: string;
      actor_type: 'agent' | 'user';
      actor_id: string;
      action: string;
      resource: string;
      result: 'allowed' | 'denied' | 'pending';
    },
  ) {
    const entry = await this.auditService.logEntry(
      body.org_id,
      body.actor_type,
      body.actor_id,
      body.action,
      body.resource,
      body.result,
    );

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      hash: entry.hash,
    };
  }

  @Get()
  async queryLogs(
    @Query('org_id') orgId: string,
    @Query('agent_id') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('result') result?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.queryLogs(
      orgId,
      agentId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      result,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('verify-chain')
  async verifyChain(
    @Query('org_id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.verifyChain(
      orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('export')
  async exportLogs(
    @Query('org_id') orgId: string,
    @Query('format') format: 'csv' | 'json',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const data = await this.auditService.exportLogs(
      orgId,
      format,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );

    if (format === 'csv') {
      res?.setHeader('Content-Type', 'text/csv');
      res?.setHeader('Content-Disposition', `attachment; filename="audit-log-${orgId}.csv"`);
    } else {
      res?.setHeader('Content-Type', 'application/json');
    }

    res?.send(data);
  }
}
