# Run doc — AgentAuth (Vite + React 19 + Tailwind 4)

Single-page app at repo root (no backend needed to view; `backend/`, `frontend/`, `sdk/`, `sdk-python/` are not part of the dev server).

## Reproduce the artifacts (fresh checkout)

1. Install dependencies with the lockfile (npm — `package-lock.json` is committed):

   ```bash
   npm ci --no-audit --no-fund
   ```

2. Env files: **none exist in the main checkout** (`ls .env*` is empty), so there is nothing to copy. If one is ever added at the repo root, copy it (do not symlink) from the main checkout before starting.

## Run the dev server

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
