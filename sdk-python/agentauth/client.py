import time
import hashlib
import hmac
import base64
import json
from typing import Optional, Dict, Any, Callable
import requests

from .errors import (
    AgentAuthError,
    PermissionDeniedError,
    ExpiredGrantError,
    UsageCapReachedError,
    PendingApprovalTimeoutError,
)


class AgentAuthClient:
    """Client for interacting with AgentAuth API"""

    def __init__(
        self,
        agent_id: str,
        private_key: str,
        api_url: str = "http://localhost:3000",
    ):
        """
        Initialize the AgentAuth client.

        Args:
            agent_id: The agent's unique identifier
            private_key: The agent's private key for signing
            api_url: The AgentAuth API base URL
        """
        self.agent_id = agent_id
        self.private_key = private_key
        self.api_url = api_url.rstrip("/")
        self._current_token: Optional[str] = None
        self._token_expires_at: Optional[float] = None

    def _sign_challenge(self, challenge: str) -> str:
        """Sign a challenge with the private key"""
        # In production, this would use proper Ed25519 signing
        # For now, use HMAC-SHA256 as a placeholder
        signature = hmac.new(
            self.private_key.encode(),
            challenge.encode(),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(signature).decode()

    def get_token(self) -> str:
        """
        Get a valid token, refreshing if necessary.

        Returns:
            A valid JWT token
        """
        # Check if we have a valid token
        if (
            self._current_token
            and self._token_expires_at
            and self._token_expires_at > time.time()
        ):
            return self._current_token

        # Fetch new challenge
        response = requests.get(
            f"{self.api_url}/api/v1/tokens/challenge",
            params={"agent_id": self.agent_id},
        )
        response.raise_for_status()
        challenge_data = response.json()

        # Sign the challenge
        signed_challenge = self._sign_challenge(challenge_data["nonce"])

        # Exchange for token
        response = requests.post(
            f"{self.api_url}/api/v1/tokens",
            json={
                "agent_id": self.agent_id,
                "signed_challenge": signed_challenge,
                "challenge_nonce": challenge_data["nonce"],
            },
        )
        response.raise_for_status()
        token_data = response.json()

        self._current_token = token_data["token"]
        self._token_expires_at = time.mktime(
            time.strptime(token_data["expires_at"], "%Y-%m-%dT%H:%M:%S.%fZ")
        )

        return self._current_token

    def check_permission(
        self,
        resource_type: str,
        resource_id: str,
        action: str,
    ) -> Dict[str, Any]:
        """
        Check if the agent has permission to perform an action.

        Args:
            resource_type: Type of resource (e.g., 'api', 'database')
            resource_id: Resource identifier or pattern
            action: Action to perform (e.g., 'read', 'write', 'delete')

        Returns:
            Permission check result with 'allowed' field
        """
        token = self.get_token()

        response = requests.post(
            f"{self.api_url}/api/v1/permissions/check",
            json={
                "token": token,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "action": action,
            },
        )
        response.raise_for_status()
        return response.json()

    def submit_action(
        self,
        resource_type: str,
        resource_id: str,
        action: str,
        payload: Optional[Dict[str, Any]] = None,
        approval_timeout: int = 300000,
    ) -> Any:
        """
        Submit an action for execution, handling approval if needed.

        Args:
            resource_type: Type of resource
            resource_id: Resource identifier
            action: Action to perform
            payload: Optional payload for the action
            approval_timeout: Timeout for approval polling (ms)

        Returns:
            Action execution result
        """
        permission = self.check_permission(resource_type, resource_id, action)

        if not permission.get("allowed"):
            reason = permission.get("reason", "Unknown reason")
            if reason == "no_matching_grant":
                raise PermissionDeniedError("No matching grant found")
            if reason == "usage_cap_reached":
                raise UsageCapReachedError(
                    permission.get("matched_grant_id", "")
                )
            raise PermissionDeniedError(reason)

        if permission.get("requires_approval"):
            # Submit for approval
            response = requests.post(
                f"{self.api_url}/api/v1/approvals",
                json={
                    "agent_id": self.agent_id,
                    "action": action,
                    "resource": f"{resource_type}:{resource_id}",
                    "context": {"payload": payload},
                },
            )
            response.raise_for_status()
            approval = response.json()

            # Poll for decision
            start_time = time.time()
            timeout_seconds = approval_timeout / 1000

            while time.time() - start_time < timeout_seconds:
                response = requests.get(
                    f"{self.api_url}/api/v1/approvals/{approval['approval_id']}",
                )
                response.raise_for_status()
                status = response.json()

                if status["status"] == "approved":
                    return self._execute_action(
                        resource_type, resource_id, action, payload
                    )

                if status["status"] == "denied":
                    raise PermissionDeniedError("Action denied by human approver")

                time.sleep(1)

            raise PendingApprovalTimeoutError(approval["approval_id"])

        # Execute action directly
        return self._execute_action(resource_type, resource_id, action, payload)

    def _execute_action(
        self,
        resource_type: str,
        resource_id: str,
        action: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an action on a resource.

        Args:
            resource_type: Type of resource
            resource_id: Resource identifier
            action: Action to perform
            payload: Optional payload

        Returns:
            Execution result
        """
        # In production, this would call the actual resource server
        return {
            "success": True,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "action": action,
            "executed_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        }

    def on_approval_decision(self, callback: Callable[[str], None]) -> None:
        """
        Register a callback for approval decisions.

        Args:
            callback: Function to call with decision ('approved' or 'denied')
        """
        # In production, this would set up a webhook listener or SSE connection
        print("Approval decision listener registered")
