import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgentGroup, Agent } from '../../database/entities';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(AgentGroup)
    private groupRepo: Repository<AgentGroup>,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
  ) {}

  async create(orgId: string, name: string, description?: string): Promise<AgentGroup> {
    const exists = await this.groupRepo.findOne({ where: { org_id: orgId, name } });
    if (exists) throw new BadRequestException(`Group "${name}" already exists in this org`);
    const group = this.groupRepo.create({ org_id: orgId, name, description: description ?? null });
    this.logger.log(`Group created: ${name} for org ${orgId}`);
    return this.groupRepo.save(group);
  }

  async findByOrg(orgId: string): Promise<AgentGroup[]> {
    return this.groupRepo.find({
      where: { org_id: orgId },
      relations: ['members'],
      order: { created_at: 'ASC' },
    });
  }

  async findOne(orgId: string, id: string): Promise<AgentGroup> {
    const group = await this.groupRepo.findOne({
      where: { id, org_id: orgId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async update(orgId: string, id: string, updates: { name?: string; description?: string }): Promise<AgentGroup> {
    const group = await this.findOne(orgId, id);
    if (updates.name !== undefined && updates.name !== group.name) {
      const exists = await this.groupRepo.findOne({ where: { org_id: orgId, name: updates.name } });
      if (exists) throw new BadRequestException(`Group "${updates.name}" already exists in this org`);
    }
    if (updates.name !== undefined) group.name = updates.name;
    if (updates.description !== undefined) group.description = updates.description;
    return this.groupRepo.save(group);
  }

  /** Replace the membership list. Validates every agent belongs to this org. */
  async setMembers(orgId: string, id: string, agentIds: string[]): Promise<AgentGroup> {
    const group = await this.findOne(orgId, id);
    const unique = [...new Set(agentIds)];
    if (unique.length > 0) {
      const agents = await this.agentRepo.find({ where: { id: In(unique), org_id: orgId } });
      if (agents.length !== unique.length) {
        throw new BadRequestException('One or more agents do not exist in this org');
      }
    }
    group.members = unique.map((id) => ({ id }) as Agent);
    this.logger.log(`Group ${id} membership set to ${unique.length} agent(s)`);
    return this.groupRepo.save(group);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const group = await this.findOne(orgId, id);
    await this.groupRepo.remove(group);
    this.logger.log(`Group deleted: ${id}`);
  }

  /**
   * All group ids the agent belongs to — the `agent_group_ids` the policy
   * engine matches `agent_group`-scoped policies against. Scoped to the
   * agent's org via the join, so membership data can never leak across orgs.
   */
  async groupIdsForAgent(orgId: string, agentId: string): Promise<string[]> {
    const rows = await this.groupRepo
      .createQueryBuilder('g')
      .innerJoin('agent_group_members', 'm', 'm.group_id = g.id')
      .where('g.org_id = :orgId', { orgId })
      .andWhere('m.agent_id = :agentId', { agentId })
      .select('g.id', 'id')
      .getRawMany();
    return rows.map((r) => r.id);
  }
}
