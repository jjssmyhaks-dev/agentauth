// Same-origin by default; Next.js rewrites proxy /api/* to the NestJS backend.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { error: error || 'Request failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// Agent endpoints
export const agentsApi = {
  list: (orgId: string) =>
    fetchApi<any[]>(`/api/v1/agents?org_id=${orgId}`),

  get: (agentId: string) =>
    fetchApi<any>(`/api/v1/agents/${agentId}`),

  create: (data: { org_id: string; name: string; public_key: string }) =>
    fetchApi<any>('/api/v1/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  rotateKey: (agentId: string, newPublicKey?: string) =>
    fetchApi<any>(`/api/v1/agents/${agentId}/rotate-key`, {
      method: 'POST',
      body: JSON.stringify({ new_public_key: newPublicKey }),
    }),

  revoke: (agentId: string) =>
    fetchApi<any>(`/api/v1/agents/${agentId}/revoke`, {
      method: 'POST',
    }),
};

// Grant endpoints
export const grantsApi = {
  list: (agentId: string) =>
    fetchApi<any[]>(`/api/v1/grants?agent_id=${agentId}`),

  create: (data: {
    agent_id: string;
    resource_type: string;
    resource_pattern: string;
    allowed_actions: string[];
    created_by_user_id: string;
    expires_at?: string;
    usage_cap?: number;
  }) =>
    fetchApi<any>('/api/v1/grants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (grantId: string, data: { expires_at?: string; usage_cap?: number }) =>
    fetchApi<any>(`/api/v1/grants/${grantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  revoke: (grantId: string) =>
    fetchApi<any>(`/api/v1/grants/${grantId}`, {
      method: 'DELETE',
    }),
};

// Approval endpoints
export const approvalsApi = {
  list: (orgId: string, status?: string) =>
    fetchApi<any[]>(`/api/v1/approvals?org_id=${orgId}${status ? `&status=${status}` : ''}`),

  get: (approvalId: string) =>
    fetchApi<any>(`/api/v1/approvals/${approvalId}`),

  decide: (approvalId: string, decision: 'approve' | 'deny', userId: string, reason?: string) =>
    fetchApi<any>(`/api/v1/approvals/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({
        decision,
        decided_by_user_id: userId,
        reason,
      }),
    }),
};

// Audit endpoints
export const auditApi = {
  list: (orgId: string, params?: {
    agent_id?: string;
    from?: string;
    to?: string;
    result?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams({ org_id: orgId });
    if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.result) searchParams.set('result', params.result);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<any>(`/api/v1/audit?${searchParams.toString()}`);
  },

  verifyChain: (orgId: string) =>
    fetchApi<any>(`/api/v1/audit/verify-chain?org_id=${orgId}`),
};

// Webhook endpoints
export const webhooksApi = {
  list: (orgId: string) =>
    fetchApi<any[]>(`/api/v1/webhooks?org_id=${orgId}`),

  create: (data: {
    org_id: string;
    url: string;
    event_types: string[];
    secret: string;
  }) =>
    fetchApi<any>('/api/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (webhookId: string) =>
    fetchApi<any>(`/api/v1/webhooks/${webhookId}`, {
      method: 'DELETE',
    }),

  test: (webhookId: string) =>
    fetchApi<any>(`/api/v1/webhooks/${webhookId}/test`, {
      method: 'POST',
    }),
};

// Analytics endpoints
export const analyticsApi = {
  overview: (orgId: string) =>
    fetchApi<any>(`/api/v1/analytics/overview?org_id=${orgId}`),

  usage: (orgId: string, days?: number) =>
    fetchApi<any[]>(`/api/v1/analytics/usage?org_id=${orgId}${days ? `&days=${days}` : ''}`),

  timeSeries: (orgId: string, agentId?: string, days?: number) => {
    const params = new URLSearchParams({ org_id: orgId });
    if (agentId) params.set('agent_id', agentId);
    if (days) params.set('days', days.toString());
    return fetchApi<any[]>(`/api/v1/analytics/timeseries?${params.toString()}`);
  },

  performance: (orgId: string) =>
    fetchApi<any[]>(`/api/v1/analytics/performance?org_id=${orgId}`),

  feedback: (orgId: string, agentId: string) =>
    fetchApi<any>(`/api/v1/analytics/feedback/${agentId}?org_id=${orgId}`),

  topAgents: (orgId: string, limit?: number) =>
    fetchApi<any[]>(`/api/v1/analytics/top-agents?org_id=${orgId}${limit ? `&limit=${limit}` : ''}`),
};
