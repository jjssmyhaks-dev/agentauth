# ADR 0001 — Treasury entities live in the public schema with a `treasury_` prefix

**Status:** Accepted · **Date:** 2026-09-21 · **Scope:** M0 foundations

## Context

The PRD (§10) specifies a dedicated PostgreSQL schema `treasury` with RLS on every table. The existing Agent Auth backend (NestJS + TypeORM, `synchronize: true` in dev) creates all entities in the `public` schema and prefixes table names by module convention (`agent_keys`, `pending_approvals`, `delegated_tokens`).

## Decision

Treasury entities live in `public` with a `treasury_` table-name prefix (e.g. `treasury_payment_intents`), following the codebase convention. RLS scripts (`backend/scripts/treasury-rls.sql`) target the public-schema tables.

## Consequences

- No new schema migration machinery; dev boots and syncs like every other module.
- The PRD's schema-qualified names (`treasury.payment_intents`) map 1:1 to `public.treasury_payment_intents`.
- Production hardening (non-owner app role + `FORCE ROW LEVEL SECURITY`) is recorded in the RLS script header.
