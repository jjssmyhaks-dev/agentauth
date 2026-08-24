class AgentAuthError(Exception):
    """Base exception for AgentAuth SDK"""
    pass


class PermissionDeniedError(AgentAuthError):
    """Raised when permission check fails"""
    pass


class ExpiredGrantError(AgentAuthError):
    """Raised when a grant has expired"""
    pass


class UsageCapReachedError(AgentAuthError):
    """Raised when usage cap is reached"""
    pass


class PendingApprovalTimeoutError(AgentAuthError):
    """Raised when approval polling times out"""
    pass
