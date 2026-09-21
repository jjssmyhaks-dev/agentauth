import time
import base64
from typing import Optional, Dict, Any, Callable

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend

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
        api_url: str = "http://localhost:4000",
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
        """Sign a challenge with the agent's RSA private key.

        The backend verifies with ``crypto.createVerify('SHA256')`` over the
        raw nonce string (RSA PKCS#1 v1.5, SHA-256), returning the signature
        base64-encoded. This must match that scheme exactly.
        """
        try:
            private_key = serialization.load_pem_private_key(
                self.private_key.encode(), password=None, backend=default_backend()
            )
        except ValueError as exc:
            raise AgentAuthError(
                "private_key must be a PEM-encoded RSA private key "
                "matching the public key registered for this agent"
            ) from exc

        signature = private_key.sign(
            challenge.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
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
        # Parse ISO-8601 timestamp (e.g. "2025-08-30T04:30:00.123Z").
        # time.strptime/time.mktime assume local time and choke on the "Z"
        # suffix — use datetime with UTC awareness instead.
        from datetime import datetime, timezone

        expires_at = token_data["expires_at"].replace("Z", "+00:00")
        self._token_expires_at = datetime.fromisoformat(expires_at).timestamp()

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
