export class AgentAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentAuthError';
  }
}

export class PermissionDeniedError extends AgentAuthError {
  constructor(reason: string) {
    super(`Permission denied: ${reason}`);
    this.name = 'PermissionDeniedError';
  }
}

export class ExpiredGrantError extends AgentAuthError {
  constructor(grantId: string) {
    super(`Grant ${grantId} has expired`);
    this.name = 'ExpiredGrantError';
  }
}

export class UsageCapReachedError extends AgentAuthError {
  constructor(grantId: string) {
    super(`Usage cap reached for grant ${grantId}`);
    this.name = 'UsageCapReachedError';
  }
}

export class PendingApprovalTimeoutError extends AgentAuthError {
  constructor(approvalId: string) {
    super(`Approval ${approvalId} timed out waiting for decision`);
    this.name = 'PendingApprovalTimeoutError';
  }
}
