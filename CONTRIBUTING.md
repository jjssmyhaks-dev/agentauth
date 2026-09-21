# Contributing to AgentAuth

Thanks for your interest in contributing! This document covers the essentials.

## Repository layout

```
├── src/            Root dashboard (Vite + React 19) — product frontend
├── backend/        NestJS API — identity, tokens, grants, approvals, audit
├── frontend/       Next.js 16 app — alternative dashboard wired to the API
├── sdk/            TypeScript SDK (agentauth-sdk)
├── sdk-python/     Python SDK (agentauth)
├── docs/           Release notes and product docs
└── .github/        Workflows (CI, CodeQL) and templates
```

## Getting started

```bash
# Root dashboard
npm ci
npm run dev          # http://localhost:5173
npm test             # vitest suite
npm run typecheck

# Backend (requires Postgres + Redis; see docker-compose.yml)
cd backend
npm ci
npm run start:dev    # http://localhost:4000, Swagger at /docs
npm test             # jest

# Frontend (Next.js)
cd ../frontend
npm ci
npm run dev

# SDKs
cd ../sdk && npm ci && npm run build
cd ../sdk-python && pip install -e . && python -m compileall agentauth
```

A `docker-compose.yml` at the repo root brings up Postgres and Redis for local backend development.

## Development workflow

1. Fork / branch from `main`
2. Make your change with tests where practical
3. Run the checks: typecheck, tests, and build for every package you touched
4. Open a PR using the template — keep it focused; one logical change per PR

## Conventions

- **Commits:** conventional-commit style (`fix:`, `feat:`, `chore:`, `refactor:`) — the same style used in history
- **TypeScript:** strict mode is on; do not loosen it
- **Tests:** bug fixes should come with a regression test pinning the bug
- **Security:** never commit secrets; see SECURITY.md for reporting vulnerabilities privately

## Reporting issues

- Bug reports: GitHub Issues with reproduction steps
- Security vulnerabilities: **private** reporting only (see SECURITY.md)
- Feature ideas: open a discussion first for anything architectural
