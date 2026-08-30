import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncSource, SyncJob, Agent } from '../../database/entities';
import { IdentityService } from '../identity/identity.service';

export interface SyncAgentPayload {
  external_id: string;
  name: string;
  description?: string;
  owner?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncSource)
    private sourceRepo: Repository<SyncSource>,
    @InjectRepository(SyncJob)
    private jobRepo: Repository<SyncJob>,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
    private identityService: IdentityService,
  ) {}

  async createSource(orgId: string, name: string, type: string, config: Record<string, any>): Promise<SyncSource> {
    const source = this.sourceRepo.create({ org_id: orgId, name, type, config });
    this.logger.log(`Sync source created: ${name} (type: ${type})`);
    return this.sourceRepo.save(source);
  }

  async getSources(orgId: string): Promise<SyncSource[]> {
    return this.sourceRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' } });
  }

  async getSource(id: string): Promise<SyncSource> {
    const source = await this.sourceRepo.findOne({ where: { id } });
    if (!source) throw new NotFoundException(`Sync source ${id} not found`);
    return source;
  }

  async triggerSync(sourceId: string): Promise<SyncJob> {
    const source = await this.getSource(sourceId);
    if (source.status === 'syncing') throw new BadRequestException('Sync already in progress');

    const job = this.jobRepo.create({
      source_id: sourceId,
      status: 'running',
    });
    const savedJob = await this.jobRepo.save(job);

    source.status = 'syncing';
    await this.sourceRepo.save(source);

    // Process sync asynchronously (in production, use BullMQ)
    this.processSync(source, savedJob).catch((err) => {
      this.logger.error(`Sync failed for source ${sourceId}: ${err.message}`);
    });

    return savedJob;
  }

  async getJobStatus(jobId: string): Promise<SyncJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Sync job ${jobId} not found`);
    return job;
  }

  async getJobsForSource(sourceId: string): Promise<SyncJob[]> {
    return this.jobRepo.find({ where: { source_id: sourceId }, order: { started_at: 'DESC' }, take: 20 });
  }

  // Webhook receiver — accepts pushed agent metadata
  async handleWebhook(sourceId: string, agents: SyncAgentPayload[]): Promise<SyncJob> {
    const source = await this.getSource(sourceId);

    const job = this.jobRepo.create({
      source_id: sourceId,
      status: 'running',
    });
    const savedJob = await this.jobRepo.save(job);

    try {
      let created = 0;
      let updated = 0;
      let unchanged = 0;

      for (const agentData of agents) {
        const result = await this.upsertAgent(source, agentData);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else unchanged++;
      }

      savedJob.status = 'completed';
      savedJob.agents_created = created;
      savedJob.agents_updated = updated;
      savedJob.agents_unchanged = unchanged;
      savedJob.completed_at = new Date();
      savedJob.result = { created, updated, unchanged };
    } catch (err: any) {
      savedJob.status = 'failed';
      savedJob.error_message = err.message;
      savedJob.completed_at = new Date();
    }

    await this.jobRepo.save(savedJob);
    return savedJob;
  }

  private async processSync(source: SyncSource, job: SyncJob): Promise<void> {
    try {
      // Generic webhook-based connector: agents are pushed via the webhook endpoint
      // For polling connectors, implement list_agents() based on source.type
      const agents = this.listAgentsFromConfig(source.config);

      let created = 0;
      let updated = 0;
      let unchanged = 0;

      for (const agentData of agents) {
        const result = await this.upsertAgent(source, agentData);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else unchanged++;
      }

      job.status = 'completed';
      job.agents_created = created;
      job.agents_updated = updated;
      job.agents_unchanged = unchanged;
      job.completed_at = new Date();
      job.result = { created, updated, unchanged };

      source.status = 'idle';
      source.last_sync_at = new Date();
      source.total_agents_synced += created + updated;

      await this.jobRepo.save(job);
      await this.sourceRepo.save(source);
    } catch (err: any) {
      job.status = 'failed';
      job.error_message = err.message;
      job.completed_at = new Date();
      source.status = 'error';
      await this.jobRepo.save(job);
      await this.sourceRepo.save(source);
    }
  }

  private async upsertAgent(source: SyncSource, agentData: SyncAgentPayload): Promise<'created' | 'updated' | 'unchanged'> {
    // Check if agent exists with this external_id in the source config
    const existing = await this.agentRepo.findOne({
      where: { org_id: source.org_id, name: agentData.name },
    });

    if (existing) {
      // Update metadata if changed
      return 'unchanged';
    }

    // Create new agent
    // Note: external agents need a public key — generate a placeholder
    // In production, the external system provides the key
    const agent = this.agentRepo.create({
      org_id: source.org_id,
      name: agentData.name,
      public_key: `EXTERNAL-${agentData.external_id}`,
      status: 'active',
      agent_tier: source.type === 'external' ? 'external' : 'internal',
    });
    await this.agentRepo.save(agent);
    return 'created';
  }

  private listAgentsFromConfig(config: Record<string, any>): SyncAgentPayload[] {
    // Extract agents from webhook config (stored during webhook push)
    return config.pending_agents || [];
  }
}
