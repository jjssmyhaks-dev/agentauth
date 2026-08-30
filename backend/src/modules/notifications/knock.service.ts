import { Injectable, Logger } from '@nestjs/common';
import { Knock } from '@knocklabs/node';

@Injectable()
export class KnockService {
  private readonly logger = new Logger(KnockService.name);
  private knock: Knock | null = null;

  constructor() {
    const apiKey = process.env.KNOCK_API_KEY;
    if (apiKey) {
      this.knock = new Knock(apiKey as any);
      this.logger.log('Knock notification service initialized');
    } else {
      this.logger.warn('KNOCK_API_KEY not set — notifications disabled');
    }
  }

  get isConfigured(): boolean {
    return this.knock !== null;
  }

  async triggerApprovalRequest(params: {
    recipientId: string;
    approvalId: string;
    agentId: string;
    action: string;
    resource: string;
    orgId: string;
  }): Promise<void> {
    if (!this.knock) return;

    try {
      await this.knock.workflows.trigger('approval-request', {
        actor: { id: params.agentId },
        recipients: [{ id: params.recipientId }],
        data: {
          approval_id: params.approvalId,
          agent_id: params.agentId,
          action: params.action,
          resource: params.resource,
          org_id: params.orgId,
        },
      });
      this.logger.log(`Knock notification sent for approval ${params.approvalId}`);
    } catch (err) {
      this.logger.error(`Failed to send Knock notification: ${err.message}`);
    }
  }

  async triggerAgentRevoked(params: {
    recipientIds: string[];
    agentId: string;
    agentName: string;
    orgId: string;
  }): Promise<void> {
    if (!this.knock) return;

    try {
      await this.knock.workflows.trigger('agent-revoked', {
        actor: { id: 'system' },
        recipients: params.recipientIds.map((id) => ({ id })),
        data: {
          agent_id: params.agentId,
          agent_name: params.agentName,
          org_id: params.orgId,
        },
      });
      this.logger.log(`Knock notification sent for agent revocation ${params.agentId}`);
    } catch (err) {
      this.logger.error(`Failed to send agent revoked notification: ${err.message}`);
    }
  }

  async triggerGrantRevoked(params: {
    recipientIds: string[];
    grantId: string;
    agentId: string;
    resource: string;
    orgId: string;
  }): Promise<void> {
    if (!this.knock) return;

    try {
      await this.knock.workflows.trigger('grant-revoked', {
        actor: { id: 'system' },
        recipients: params.recipientIds.map((id) => ({ id })),
        data: {
          grant_id: params.grantId,
          agent_id: params.agentId,
          resource: params.resource,
          org_id: params.orgId,
        },
      });
      this.logger.log(`Knock notification sent for grant revocation ${params.grantId}`);
    } catch (err) {
      this.logger.error(`Failed to send grant revoked notification: ${err.message}`);
    }
  }
}
