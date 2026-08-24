import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AuditLog } from '../../database/entities';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async logEntry(
    orgId: string,
    actorType: 'agent' | 'user',
    actorId: string,
    action: string,
    resource: string,
    result: 'allowed' | 'denied' | 'pending',
  ): Promise<AuditLog> {
    // Get previous entry for hash chaining
    const prevEntry = await this.auditRepository.findOne({
      where: { org_id: orgId },
      order: { timestamp: 'DESC' },
    });

    const prevHash = prevEntry?.hash || '0';
    const timestamp = new Date();

    // Compute hash: sha256(prev_hash + entry_payload)
    const payload = JSON.stringify({
      org_id: orgId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      resource,
      result,
      timestamp: timestamp.toISOString(),
    });

    const hash = crypto
      .createHash('sha256')
      .update(prevHash + payload)
      .digest('hex');

    const entry = this.auditRepository.create({
      org_id: orgId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      resource,
      result,
      timestamp,
      prev_hash: prevHash,
      hash,
    });

    return this.auditRepository.save(entry);
  }

  async queryLogs(
    orgId: string,
    agentId?: string,
    from?: Date,
    to?: Date,
    result?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: AuditLog[]; total: number; page: number; pages: number }> {
    const query = this.auditRepository.createQueryBuilder('audit')
      .where('audit.org_id = :orgId', { orgId });

    if (agentId) {
      query.andWhere('audit.actor_id = :agentId', { agentId });
    }
    if (from) {
      query.andWhere('audit.timestamp >= :from', { from });
    }
    if (to) {
      query.andWhere('audit.timestamp <= :to', { to });
    }
    if (result) {
      query.andWhere('audit.result = :result', { result });
    }

    const [data, total] = await query
      .orderBy('audit.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async verifyChain(
    orgId: string,
    from?: Date,
    to?: Date,
  ): Promise<{ valid: boolean; checked_entries: number; broken_at_entry_id?: string }> {
    const query = this.auditRepository.createQueryBuilder('audit')
      .where('audit.org_id = :orgId', { orgId })
      .orderBy('audit.timestamp', 'ASC');

    if (from) {
      query.andWhere('audit.timestamp >= :from', { from });
    }
    if (to) {
      query.andWhere('audit.timestamp <= :to', { to });
    }

    const entries = await query.getMany();

    let prevHash = '0';
    for (const entry of entries) {
      // Recompute hash
      const payload = JSON.stringify({
        org_id: entry.org_id,
        actor_type: entry.actor_type,
        actor_id: entry.actor_id,
        action: entry.action,
        resource: entry.resource,
        result: entry.result,
        timestamp: entry.timestamp.toISOString(),
      });

      const expectedHash = crypto
        .createHash('sha256')
        .update(prevHash + payload)
        .digest('hex');

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          checked_entries: entries.indexOf(entry),
          broken_at_entry_id: entry.id,
        };
      }

      if (entry.prev_hash !== prevHash) {
        return {
          valid: false,
          checked_entries: entries.indexOf(entry),
          broken_at_entry_id: entry.id,
        };
      }

      prevHash = entry.hash;
    }

    return {
      valid: true,
      checked_entries: entries.length,
    };
  }

  async exportLogs(
    orgId: string,
    format: 'csv' | 'json',
    from?: Date,
    to?: Date,
  ): Promise<string> {
    const query = this.auditRepository.createQueryBuilder('audit')
      .where('audit.org_id = :orgId', { orgId })
      .orderBy('audit.timestamp', 'ASC');

    if (from) {
      query.andWhere('audit.timestamp >= :from', { from });
    }
    if (to) {
      query.andWhere('audit.timestamp <= :to', { to });
    }

    const entries = await query.getMany();

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = 'id,org_id,actor_type,actor_id,action,resource,result,timestamp,prev_hash,hash\n';
    const rows = entries.map((e) =>
      `${e.id},${e.org_id},${e.actor_type},${e.actor_id},${e.action},${e.resource},${e.result},${e.timestamp},${e.prev_hash},${e.hash}`
    ).join('\n');

    return headers + rows;
  }
}
