# Security Policy

AgentAuth is an identity and permissions platform for AI agents. Security issues in this project are treated with the highest priority.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.4.x   | ✅        |
| < 0.4   | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, use GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository
2. Click **Report a vulnerability**
3. Include: affected component (dashboard / backend API / TS SDK / Python SDK), a description, and reproduction steps or a proof of concept

You can expect an initial response within **72 hours**. We will keep you informed of progress toward a fix and coordinate a disclosure date together.

## Security architecture notes

The following are in-scope areas of particular sensitivity:

- **Token issuance** (`backend/src/modules/token/`) — challenge-response nonce flow, JWT signing keys, JWKS endpoint
- **Grant/permission evaluation** (`backend/src/modules/grants/`, `policies/`) — pattern matching, usage caps, expiry
- **Audit hash chain** (`backend/src/modules/audit/`) — tamper-evidence guarantees
- **Dashboard auth** (`frontend/`, root `src/`) — session handling, Supabase integration
- **SDKs** (`sdk/`, `sdk-python/`) — challenge signing implementations

## Known current limitations (transparency)

- CORS currently defaults to a wildcard when `CORS_ORIGIN` is unset — always set it in production
- The rate limiter covers the token, permissions, and analytics route groups only
- JWT signing keys are ephemeral (generated per boot) unless `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` are provided — set them in production and plan for rotation
- TypeORM `synchronize` should be `false` in production; use migrations (`npm run migration:run` in `backend/`)

## Hardening roadmap

Dependency and secret scanning (Dependabot, `npm audit` gate, CodeQL) run in CI. See `.github/workflows/` for specifics.
