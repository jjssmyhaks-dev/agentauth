# Run doc — AgentAuth (Vite + React 19 + Tailwind 4)

Single-page app at repo root. Two preview modes:

- **Mock mode (default)** — no backend needed. Just `npm run dev`; dashboard shows simulated data. Use for UI-only walkthroughs.
- **API mode** — dashboard wired to the real NestJS backend. Use to verify the real integration. Recipe below.

## Reproduce the artifacts (fresh checkout)

1. Install dependencies with the lockfile (npm — `package-lock.json` is committed):

   ```bash
   npm ci --no-audit --no-fund
   ```

2. Env files: **none exist in the main checkout** (`ls .env*` is empty), so there is nothing to copy. If one is ever added at the repo root, copy it (do not symlink) from the main checkout before starting.

## API mode (full stack)

Prereqs: Docker Desktop running, backend deps installed (`npm ci --prefix backend`).

```bash
# 1. Postgres + Redis (docker-compose.yml)
docker compose up -d db redis

# 2. Backend on :4123 — needs backend/.env (gitignored) with at least:
#    PORT=4123, DATABASE_URL=postgres://agentauth:agentauth@localhost:5432/agentauth,
#    REDIS_URL=redis://localhost:6379, CORS_ORIGIN=http://localhost:5173
#    Copy values from backend/.env.example; NEVER commit the real .env.
#    Start detached (see recipe below) or: npm run start:dev --prefix backend

# 3. Sanity: health endpoint is OUTSIDE the /api prefix
curl -s http://localhost:4123/health     # {"status":"healthy",...} — also seeds the demo org

# 4. Dashboard with VITE_API_URL set (Vite must be STARTED with it in env)
VITE_API_URL=http://localhost:4123 npm run dev
```

Verify API mode in the browser: `window.__AGENTAUTH_DATA_SOURCE__ === "api"` (logged as `[agentauth] data source: api (...)` in console). Gotchas learned live:

- `PORT=0` can leak into spawned processes from the tool shell — the backend guards it (`parseInt(PORT) || 4000`), but prefer explicit `PORT` in `backend/.env`.
- `Start-Process` with `-RedirectStandardOutput/Error` into `.freebuff/*.log` files may hang the calling shell even though the process starts — verify via the listener port, not the exit.
- Full page reloads reset demo state in mock mode; in API mode, data survives (it lives in Postgres).

## Run the dev server (mock mode)

- Script: `npm run dev` → `vite --host 0.0.0.0`
- Default port: **5173** (project default). Override with the `PORT` env var (read in `vite.config.ts`) if 5173 is taken — check first with `netstat -ano | grep ":5173"` and only adapt env/flags if occupied.
- Sanity checks: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` should return `200`.

### Detached start (Windows, per platform recipe)

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

- Executable must be `npm.cmd` (Start-Process does not resolve shims).
- stdout and stderr MUST go to two different files or PowerShell fails.
- The command may not return within a normal timeout even though the server starts — verify by checking the listener (`netstat -ano | grep ":5173"` → pid), then `Get-Process -Id <pid>`, then the HTTP check above.
