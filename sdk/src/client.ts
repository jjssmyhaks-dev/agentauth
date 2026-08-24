import * as crypto from 'crypto';
import {
  AgentAuthError,
  PermissionDeniedError,
  ExpiredGrantError,
  UsageCapReachedError,
  PendingApprovalTimeoutError,
} from './errors';

interface TokenResponse {
  token: string;
  expires_at: string;
  scopes: any[];
}

interface PermissionCheckResponse {
  allowed: boolean;
  matched_grant_id?: string;
  requires_approval?: boolean;
  reason?: string;
}

interface ApprovalResponse {
  approval_id: string;
  status: 'pending' | 'approved' | 'denied';
}

export class AgentAuthClient {
  private apiUrl: string;
  private agentId: string;
  private privateKey: string;
  private currentToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(agentId: string, privateKey: string, apiUrl: string = 'http://localhost:3000') {
    this.agentId = agentId;
    this.privateKey = privateKey;
    this.apiUrl = apiUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new AgentAuthError(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private signChallenge(challenge: string): string {
    // Sign the challenge with the private key
    // In production, this would use proper Ed25519 signing
    const sign = crypto.createSign('SHA256');
    sign.update(challenge);
    const signature = sign.sign(this.privateKey, 'base64');
    return signature;
  }

  async getToken(): Promise<string> {
    // Check if we have a valid token
    if (this.currentToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.currentToken;
    }

    // Fetch new challenge
    const challengeResponse = await this.fetch<{ nonce: string; expires_at: string }>(
      `/api/v1/tokens/challenge?agent_id=${this.agentId}`,
    );

    // Sign the challenge
    const signedChallenge = this.signChallenge(challengeResponse.nonce);

    // Exchange for token
    const tokenResponse = await this.fetch<TokenResponse>('/api/v1/tokens', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: this.agentId,
        signed_challenge: signedChallenge,
        challenge_nonce: challengeResponse.nonce,
      }),
    });

    this.currentToken = tokenResponse.token;
    this.tokenExpiresAt = new Date(tokenResponse.expires_at);

    return this.currentToken;
  }

  async checkPermission(
    resourceType: string,
    resourceId: string,
    action: string,
  ): Promise<PermissionCheckResponse> {
    const token = await this.getToken();

    return this.fetch<PermissionCheckResponse>('/api/v1/permissions/check', {
      method: 'POST',
      body: JSON.stringify({
        token,
        resource_type: resourceType,
        resource_id: resourceId,
        action,
      }),
    });
  }

  async submitAction(
    resourceType: string,
    resourceId: string,
    action: string,
    payload?: any,
    options?: { approvalTimeout?: number },
  ): Promise<any> {
    const permission = await this.checkPermission(resourceType, resourceId, action);

    if (!permission.allowed) {
      if (permission.reason === 'no_matching_grant') {
        throw new PermissionDeniedError('No matching grant found');
      }
      if (permission.reason === 'usage_cap_reached') {
        throw new UsageCapReachedError(permission.matched_grant_id || '');
      }
      throw new PermissionDeniedError(permission.reason || 'Unknown reason');
    }

    if (permission.requires_approval) {
      // Submit for approval
      const approval = await this.fetch<ApprovalResponse>('/api/v1/approvals', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: this.agentId,
          action,
          resource: `${resourceType}:${resourceId}`,
          context: { payload },
        }),
      });

      // Poll for decision
      const timeout = options?.approvalTimeout || 300000; // 5 minutes default
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const status = await this.fetch<ApprovalResponse>(
          `/api/v1/approvals/${approval.approval_id}`,
        );

        if (status.status === 'approved') {
          // Proceed with action
          return this.executeAction(resourceType, resourceId, action, payload);
        }

        if (status.status === 'denied') {
          throw new PermissionDeniedError('Action denied by human approver');
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      throw new PendingApprovalTimeoutError(approval.approval_id);
    }

    // Execute action directly
    return this.executeAction(resourceType, resourceId, action, payload);
  }

  private async executeAction(
    resourceType: string,
    resourceId: string,
    action: string,
    payload?: any,
  ): Promise<any> {
    // In production, this would call the actual resource server
    // For now, return success
    return {
      success: true,
      resource_type: resourceType,
      resource_id: resourceId,
      action,
      executed_at: new Date().toISOString(),
    };
  }

  onApprovalDecision(callback: (decision: 'approved' | 'denied') => void): void {
    // In production, this would set up a webhook listener or SSE connection
    console.log('Approval decision listener registered');
  }
}
