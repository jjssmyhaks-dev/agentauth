import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent, Grant, Session, EnvironmentFingerprint, AgentAttribute, AgentGroup, TrustScore } from '../../database/entities';

export interface GraphNode {
  id: string;
  type: 'agent' | 'resource' | 'group' | 'session' | 'owner';
  label: string;
  data?: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Grant) private grantRepo: Repository<Grant>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(TrustScore) private trustScoreRepo: Repository<TrustScore>,
    @InjectRepository(AgentAttribute) private attrRepo: Repository<AgentAttribute>,
  ) {}

  async getGraph(scope: string, scopeId: string): Promise<GraphResult> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    if (scope === 'agent' && scopeId) {
      await this.buildAgentGraph(scopeId, nodes, edges, nodeIds);
    } else if (scope === 'resource' && scopeId) {
      await this.buildResourceGraph(scopeId, nodes, edges, nodeIds);
    } else if (scope === 'org' && scopeId) {
      await this.buildOrgGraph(scopeId, nodes, edges, nodeIds);
    }

    return { nodes, edges };
  }

  private async buildAgentGraph(agentId: string, nodes: GraphNode[], edges: GraphEdge[], nodeIds: Set<string>) {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) return;

    this.addNode(nodeIds, nodes, { id: agent.id, type: 'agent', label: agent.name, data: { status: agent.status, tier: agent.agent_tier } });

    // Trust score
    const trust = await this.trustScoreRepo.findOne({ where: { agent_id: agentId } });
    if (trust) {
      const trustNodeId = `trust:${agentId}`;
      this.addNode(nodeIds, nodes, { id: trustNodeId, type: 'agent', label: `Trust: ${trust.level} (${trust.score})` });
      edges.push({ from: agentId, to: trustNodeId, relation: 'has_trust_score' });
    }

    // Grants → resources
    const grants = await this.grantRepo.find({ where: { agent_id: agentId, status: 'active' } });
    for (const grant of grants) {
      const resourceId = `resource:${grant.resource_type}:${grant.resource_pattern}`;
      this.addNode(nodeIds, nodes, { id: resourceId, type: 'resource', label: `${grant.resource_type}:${grant.resource_pattern}` });
      edges.push({ from: agentId, to: resourceId, relation: `can_access [${grant.allowed_actions.join(',')}]` });
    }

    // Active sessions
    const sessions = await this.sessionRepo.find({ where: { agent_id: agentId, status: 'active' } });
    for (const session of sessions) {
      const sessionNodeId = `session:${session.id}`;
      this.addNode(nodeIds, nodes, { id: sessionNodeId, type: 'session', label: `Session ${session.id.slice(0, 8)}` });
      edges.push({ from: agentId, to: sessionNodeId, relation: 'has_session' });
    }

    // Attributes
    const attrs = await this.attrRepo.find({ where: { agent_id: agentId } });
    for (const attr of attrs) {
      const attrNodeId = `attr:${agentId}:${attr.key}`;
      this.addNode(nodeIds, nodes, { id: attrNodeId, type: 'agent', label: `${attr.key}: ${attr.value}` });
      edges.push({ from: agentId, to: attrNodeId, relation: 'has_attribute' });
    }
  }

  private async buildResourceGraph(resourceType: string, nodes: GraphNode[], edges: GraphEdge[], nodeIds: Set<string>) {
    const resourceId = `resource:${resourceType}`;
    this.addNode(nodeIds, nodes, { id: resourceId, type: 'resource', label: resourceType });

    const grants = await this.grantRepo.find({ where: { resource_type: resourceType, status: 'active' } });
    for (const grant of grants) {
      const agent = await this.agentRepo.findOne({ where: { id: grant.agent_id } });
      if (agent) {
        this.addNode(nodeIds, nodes, { id: agent.id, type: 'agent', label: agent.name });
        edges.push({ from: agent.id, to: resourceId, relation: `can_access [${grant.allowed_actions.join(',')}]` });
      }
    }
  }

  private async buildOrgGraph(orgId: string, nodes: GraphNode[], edges: GraphEdge[], nodeIds: Set<string>) {
    const agents = await this.agentRepo.find({ where: { org_id: orgId } });
    for (const agent of agents) {
      this.addNode(nodeIds, nodes, { id: agent.id, type: 'agent', label: agent.name });
    }

    const grants = await this.grantRepo.find({ where: { org_id: orgId, status: 'active' } });
    for (const grant of grants) {
      const resourceId = `resource:${grant.resource_type}:${grant.resource_pattern}`;
      this.addNode(nodeIds, nodes, { id: resourceId, type: 'resource', label: `${grant.resource_type}:${grant.resource_pattern}` });
      edges.push({ from: grant.agent_id, to: resourceId, relation: grant.allowed_actions.join(',') });
    }
  }

  private addNode(nodeIds: Set<string>, nodes: GraphNode[], node: GraphNode) {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  }
}
