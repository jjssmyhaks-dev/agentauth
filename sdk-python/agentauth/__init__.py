from .client import AgentAuthClient
from .errors import (
    AgentAuthError,
    PermissionDeniedError,
    ExpiredGrantError,
    UsageCapReachedError,
    PendingApprovalTimeoutError,
)

__version__ = "1.0.0"
__all__ = [
    "AgentAuthClient",
    "AgentAuthError",
    "PermissionDeniedError",
    "ExpiredGrantError",
    "UsageCapReachedError",
    "PendingApprovalTimeoutError",
]
