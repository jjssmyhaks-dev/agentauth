# Policy Language Reference

Policies are real-time rules that gate **every** permission check. A matched
grant makes an action *grantable*; policies decide whether it actually
happens — they can deny it, require a human, demand step-up verification, or
allow it contextually. Policies can never *grant* access that no grant
covers.

## Anatomy

```json
{
  "scope": "org | agent | agent_group",
  "scope_target_id": "<uuid, only for scoped rules>",
  "trigger": "permission_check",
  "condition": { "resource_type": "database", "action": "delete" },
  "action": "require_approval",
  "priority": 100,
  "enabled": true,
  "description": "Database deletes always need a human"
}
```

## Triggers

| Trigger | Fires when |
| --- | --- |
| `permission_check` | Every real-time authorization decision (the core loop) |
| `off_hours` | Async event outside business hours |
| `new_environment` | Agent seen from an unfamiliar environment |
| `session_mismatch` | Possible session hijack detected |
| `trust_below_threshold` | Agent trust score dropped below its threshold |
| `resource_sensitivity_high` | Access touches high-sensitivity resources |

## Conditions

A condition maps context fields to expected values. All entries must match
(logical AND). Empty condition `{}` matches everything.

| Form | Example | Meaning |
| --- | --- | --- |
| literal | `"resource_type": "database"` | exact equality |
| boolean shorthand | `"off_hours": true` | field is truthy / falsy |
| array | `"action": ["read", "write"]` | field is one of the values |
| operator object | `"current_trust_level": { "$gte": "trusted" }` | see operators |

### Operators

| Operator | Meaning |
| --- | --- |
| `$eq` / `$ne` | equal / not equal |
| `$gt` `$gte` `$lt` `$lte` | ordered comparison; trust levels rank `untrusted < questionable < normal < trusted`, numbers compare numerically, anything else fails closed |
| `$in` / `$nin` | member / not member of the operand array |
| `$exists` | field present (`true`) or absent (`false`) |

Unknown operators fail closed — the policy silently never matches, and the
API rejects creating one that uses no recognized operator.

### Context fields available to `permission_check`

`resource_type`, `resource_id`, `action`, `current_trust_level`,
`resource_sensitivity`, `off_hours`, `session_mismatch`, `new_environment`,
`current_hour`, `agent_id`, `org_id` — plus any custom field the caller
attaches.

## Evaluation order

For a given context, all enabled policies with the matching trigger are
evaluated in a deterministic order:

1. **Scope specificity** — `agent` > `agent_group` > `org`
2. **Priority** — higher first
3. **Creation time** — oldest first

The **first match wins**. So a scoped, high-priority `deny` reliably
overrides a broad org `allow`.

## Actions

| Action | Effect on a matched grant |
| --- | --- |
| `deny` | Request rejected, reason `policy_denied`, audited |
| `step_up` | Request rejected with `step_up_required` (agent must re-verify) |
| `require_approval` | Decision becomes `requires_approval: true` — a human must approve |
| `allow` | Contextual allow (no-op unless a stricter rule would have fired) |

If no policy matches, a matched grant is allowed by default.

## API

```
POST   /v1/policies            create (validates trigger + operators)
GET    /v1/policies?org_id=    list
GET    /v1/policies/:id        fetch one
PUT    /v1/policies/:id        update (enabled, action, priority, …)
DELETE /v1/policies/:id        delete
POST   /v1/policies/simulate   dry-run an event: which policy would win?
```

`simulate` returns the evaluation in order — the dashboard's
"Test a policy" panel renders it, so you can prove a rule fires *before* it
guards production traffic.

Every real check records the outcome in the hash-chained audit log
(`permission.check` with result `allowed`/`denied`).
