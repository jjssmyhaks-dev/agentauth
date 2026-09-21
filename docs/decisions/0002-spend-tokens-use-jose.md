# ADR 0002 — Spend tokens signed with `jose` (EdDSA), not @nestjs/jwt

**Status:** Accepted · **Date:** 2026-09-21 · **Scope:** M3 tokens

## Context

FR-ID-3 mandates EdDSA-signed spend authorization tokens. `@nestjs/jwt` wraps `jsonwebtoken` → `jws` 3.x, whose algorithm table has no `EdDSA`; signing failed at runtime with `"algorithm" must be a valid string enum value`. The PRD's tech stack (§9.5) already names `jose` as the crypto library of record.

## Decision

`TreasuryService` signs and verifies spend tokens with `jose` (`SignJWT` / `jwtVerify`) over Node `KeyObject`s derived from `TREASURY_SPEND_PRIVATE_KEY` / `TREASURY_SPEND_PUBLIC_KEY` (PEM or JWK accepted). The `@nestjs/jwt` `JwtService` dependency was removed from the treasury module.

## Consequences

- Token TTL is enforced with an absolute `exp` (now + 120 s) per FR-ID-3; JWKS export comes from the verify `KeyObject` with `kid: treasury-spend-key-1`.
- The rest of the platform keeps `@nestjs/jwt`; a future consolidation can migrate it to `jose` without touching the treasury API.
