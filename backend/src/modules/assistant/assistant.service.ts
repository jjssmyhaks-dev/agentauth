import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, Policy, TrustScore, TrustEvent, Agent } from '../../database/entities';

export interface AssistantQuery {
  query: string;
  org_id: string;
  user_id?: string;
}

export interface AssistantResponse {
  answer: string;
  sources: Array<{ type: string; id?: string; snippet?: string }>;
  tools_used: string[];
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Policy) private policyRepo: Repository<Policy>,
    @InjectRepository(TrustScore) private trustScoreRepo: Repository<TrustScore>,
    @InjectRepository(TrustEvent) private trustEventRepo: Repository<TrustEvent>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
  ) {}

  async query(params: AssistantQuery): Promise<AssistantResponse> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return {
        answer: 'AI Assistant is not configured. Please set GOOGLE_API_KEY.',
        sources: [],
        tools_used: [],
      };
    }

    try {
      // Dynamic import to avoid build issues if package not installed
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: this.getToolDeclarations(),
      });

      const chat = model.startChat({
        history: [],
      });

      // Send the user query
      const result = await chat.sendMessage(params.query);
      const response = result.response;

      // Process function calls
      const toolsUsed: string[] = [];
      const sources: Array<{ type: string; id?: string; snippet?: string }> = [];
      let answer = response.text();

      // Check if there were function calls
      const functionCalls = response.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          const toolResult = await this.executeTool(fc.name, fc.args, params.org_id);
          toolsUsed.push(fc.name);
          if (toolResult.sources) sources.push(...toolResult.sources);

          // Send tool results back to the model
          await chat.sendMessage([
            {
              functionResponse: {
                name: fc.name,
                response: toolResult.data,
              },
            },
          ]);
        }

        // Get final response after tool use
        const finalResult = await chat.sendMessage('Based on the tool results above, provide a clear answer to the user.');
        answer = finalResult.response.text();
      }

      return { answer, sources, tools_used: toolsUsed };
    } catch (err: any) {
      this.logger.error(`AI Assistant error: ${err.message}`);
      return {
        answer: `I encountered an error processing your query: ${err.message}. Please try again.`,
        sources: [],
        tools_used: [],
      };
    }
  }

  private getToolDeclarations(): any[] {
    return [
      {
        name: 'get_agent_audit_log',
        description: 'Retrieve recent audit log entries for a specific agent or across the organization. Use this to answer questions about what an agent has done, what was denied, or recent activity.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string', description: 'Filter by agent ID (optional)' },
            event_type: { type: 'string', description: 'Filter by event type like approval.requested, permission.denied (optional)' },
            limit: { type: 'number', description: 'Max results to return (default 20)' },
          },
        },
      },
      {
        name: 'get_policy_for_agent',
        description: 'Get all policies that apply to a specific agent or the whole org. Use this to answer questions about what rules are in place.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string', description: 'Get policies scoped to this agent (optional)' },
          },
        },
      },
      {
        name: 'get_agent_trust_score',
        description: 'Get the trust score and recent trust events for an agent. Use this to answer questions about an agent\'s trust level.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string', description: 'The agent ID to check' },
          },
          required: ['agent_id'],
        },
      },
      {
        name: 'search_docs',
        description: 'Search the AgentAuth documentation for setup guides, API reference, and feature explanations.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ];
  }

  private async executeTool(
    toolName: string,
    args: Record<string, any>,
    orgId: string,
  ): Promise<{ data: any; sources?: Array<{ type: string; id?: string; snippet?: string }> }> {
    switch (toolName) {
      case 'get_agent_audit_log': {
        const qb = this.auditRepo.createQueryBuilder('log')
          .orderBy('log.created_at', 'DESC')
          .take(args.limit || 20);

        if (args.agent_id) qb.where('log.actor_id = :agentId', { agentId: args.agent_id });
        if (args.event_type) qb.andWhere('log.action LIKE :actionPattern', { actionPattern: `%${args.event_type}%` });

        const logs = await qb.getMany();
        return {
          data: logs,
          sources: logs.map((l) => ({ type: 'audit', id: l.id, snippet: `${l.action} on ${l.resource}` })),
        };
      }

      case 'get_policy_for_agent': {
        const policies = await this.policyRepo.find({
          where: [
            { org_id: orgId, scope: 'org' },
            { org_id: orgId, scope: 'agent', scope_target_id: args.agent_id },
          ],
        });
        return { data: policies };
      }

      case 'get_agent_trust_score': {
        const trust = await this.trustScoreRepo.findOne({ where: { agent_id: args.agent_id } });
        const events = await this.trustEventRepo.find({
          where: { agent_id: args.agent_id },
          order: { timestamp: 'DESC' },
          take: 10,
        });
        return {
          data: { trust_score: trust, recent_events: events },
          sources: events.map((e) => ({ type: 'trust_event', snippet: `${e.event_type}: delta ${e.trust_delta}` })),
        };
      }

      case 'search_docs': {
        // Simple keyword search over built-in documentation
        const docs = this.getDocSnippets(args.query);
        return {
          data: docs,
          sources: docs.map((d: any) => ({ type: 'docs', snippet: d.title })),
        };
      }

      default:
        return { data: { error: `Unknown tool: ${toolName}` } };
    }
  }

  private getDocSnippets(query: string): Array<{ title: string; content: string }> {
    const docs = [
      { title: 'Token Flow', content: 'Agents authenticate by requesting a challenge (nonce), signing it with their private key, and exchanging it for a short-lived JWT. The JWT contains scopes from active grants.' },
      { title: 'Grant Management', content: 'Grants define what resources an agent can access and what actions it can perform. Each grant has a resource_type, resource_pattern, and allowed_actions array.' },
      { title: 'Approval Workflow', content: 'When approval_mode is human_in_the_loop, certain actions require human approval before execution. Use POST /v1/approvals to create, GET to list, POST /:id/decide to approve or deny.' },
      { title: 'Trust Scoring', content: 'Trust scores (0-100) are calculated from behavioral signals. Events like new IPs, unusual volume, or concurrent key usage decrease trust. Scores decay back toward 50 over time.' },
      { title: 'Policy Engine', content: 'Policies define automated responses to events. They have a scope (org/agent/group), trigger condition, and action (allow/approve/deny). Use POST /policies/simulate to test.' },
      { title: 'Webhook Delivery', content: 'Webhooks receive HMAC-SHA256 signed event payloads. Configure with POST /v1/webhooks. Each webhook has a secret for signature verification.' },
      { title: 'SDK Usage', content: 'TypeScript: import { AgentAuth } from "agentauth-sdk". Python: from agentauth import AgentAuthClient. Both support register, challenge, authenticate, and checkPermission.' },
      { title: 'Emergency Revocation', content: 'POST /v1/agents/:id/emergency-revoke immediately kills all keys and revokes the agent. Always requires a reason and human approval.' },
    ];

    const lowerQuery = query.toLowerCase();
    return docs.filter((d) =>
      d.title.toLowerCase().includes(lowerQuery) ||
      d.content.toLowerCase().includes(lowerQuery)
    );
  }
}
