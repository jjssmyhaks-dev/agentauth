import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentAttribute, AgentGroup, Agent } from '../../database/entities';

@Injectable()
export class AttributesService {
  private readonly logger = new Logger(AttributesService.name);

  constructor(
    @InjectRepository(AgentAttribute)
    private attrRepo: Repository<AgentAttribute>,
    @InjectRepository(AgentGroup)
    private groupRepo: Repository<AgentGroup>,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
  ) {}

  // ── Attributes ──

  async getAttributes(agentId: string): Promise<AgentAttribute[]> {
    return this.attrRepo.find({ where: { agent_id: agentId }, order: { key: 'ASC' } });
  }

  async setAttributes(agentId: string, attributes: Array<{ key: string; value: string }>): Promise<AgentAttribute[]> {
    const results: AgentAttribute[] = [];
    for (const { key, value } of attributes) {
      let attr = await this.attrRepo.findOne({ where: { agent_id: agentId, key } });
      if (attr) {
        attr.value = value;
      } else {
        attr = this.attrRepo.create({ agent_id: agentId, key, value });
      }
      results.push(await this.attrRepo.save(attr));
    }
    this.logger.log(`Set ${results.length} attributes for agent ${agentId}`);
    return results;
  }

  async deleteAttribute(agentId: string, key: string): Promise<void> {
    const attr = await this.attrRepo.findOne({ where: { agent_id: agentId, key } });
    if (!attr) throw new NotFoundException(`Attribute "${key}" not found for agent ${agentId}`);
    await this.attrRepo.remove(attr);
  }

  // ── Groups ──

  async createGroup(orgId: string, name: string, description?: string, filter?: Record<string, any>): Promise<AgentGroup> {
    const group = this.groupRepo.create({ org_id: orgId, name, description, filter });
    this.logger.log(`Group created: ${name} (org: ${orgId})`);
    return this.groupRepo.save(group);
  }

  async getGroups(orgId: string): Promise<AgentGroup[]> {
    return this.groupRepo.find({ where: { org_id: orgId }, relations: ['members'], order: { name: 'ASC' } });
  }

  async getGroup(id: string): Promise<AgentGroup> {
    const group = await this.groupRepo.findOne({ where: { id }, relations: ['members'] });
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async updateGroup(id: string, updates: Partial<{ name: string; description: string; filter: Record<string, any> }>): Promise<AgentGroup> {
    const group = await this.getGroup(id);
    Object.assign(group, updates);
    return this.groupRepo.save(group);
  }

  async deleteGroup(id: string): Promise<void> {
    const group = await this.getGroup(id);
    await this.groupRepo.remove(group);
  }

  async addMember(groupId: string, agentId: string): Promise<AgentGroup> {
    const group = await this.getGroup(groupId);
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    if (!group.members) group.members = [];
    if (!group.members.find((m) => m.id === agentId)) {
      group.members.push(agent);
      await this.groupRepo.save(group);
    }
    return group;
  }

  async removeMember(groupId: string, agentId: string): Promise<AgentGroup> {
    const group = await this.getGroup(groupId);
    if (group.members) {
      group.members = group.members.filter((m) => m.id !== agentId);
      await this.groupRepo.save(group);
    }
    return group;
  }

  // Find groups matching an agent by attribute filter
  async findMatchingGroups(agentId: string): Promise<AgentGroup[]> {
    const attrs = await this.getAttributes(agentId);
    const attrMap = new Map(attrs.map((a) => [a.key, a.value]));

    const allGroups = await this.groupRepo.find({ where: { org_id: attrs[0] ? '' : '' }, relations: [] });
    // Fetch all groups across orgs for this agent's org
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) return [];
    const groups = await this.groupRepo.find({ where: { org_id: agent.org_id } });

    return groups.filter((g) => {
      if (!g.filter || Object.keys(g.filter).length === 0) return false;
      return Object.entries(g.filter).every(([key, expected]) => attrMap.get(key) === expected);
    });
  }
}
