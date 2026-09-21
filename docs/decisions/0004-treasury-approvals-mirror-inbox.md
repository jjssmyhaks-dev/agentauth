# ADR 0004 — Treasury approvals mirror into the existing approval inbox

**Status:** Accepted · **Date:** 2026-09-21 · **Scope:** M4 approvals

## Context

FR-APR-1..6 require a payment approval flow with full context (agent, task, counterparty, amount, triggering rule, budget remaining) and signed decisions. The platform already ships a `PendingApproval` inbox with audit logging and notifications, surfaced on the dashboard's Approvals page.

## Decision

When policy returns `require_approval`, the treasury creates its own `TreasuryApproval` row (intent hash, required quorum/roles, expiry — the source of truth for the payment flow) **and** mirrors the request into the platform inbox via `ApprovalService.create(agentId, "treasury:<rule_id>", "payment_intent:<id>", context)` with the amount, asset, counterparty, rail, purpose and intent hash. The mirror is non-fatal: a failure to create it never blocks the treasury decision.

## Consequences

- Approvals appear in the existing dashboard inbox without new UI plumbing; the treasury intent keeps its own passkey-signature flow via `POST /v1/treasury/approvals/:id/decide`.
- One requirement (FR-APR-2, email channel) rides on the inbox's existing Knock notification hook.
