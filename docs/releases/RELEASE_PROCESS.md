# Release process

Releases are tag-driven: push a tag, get artifacts.

```bash
git tag v0.4.2 && git push origin v0.4.2
```

The [`release.yml`](../../.github/workflows/release.yml) pipeline produces:

| Artifact | Where | What |
|---|---|---|
| Dashboard static bundle | Actions artifact `dashboard-dist` + asset `agentauth-dashboard-<tag>.zip` on the GitHub Release | Root Vite app production build (serve `dist/` from any static host) |
| Container image | `ghcr.io/<owner>/<repo>:<tag>` (plus `latest`, plus `sha-<sha>`) | Backend API + Next.js dashboard, per the repo `Dockerfile` |
| GitHub Release | Releases page | Auto-generated notes from commits since the last tag + the dashboard zip |

Notes:

- `workflow_dispatch` runs are dry-run builds — the image is built (and cached) but not pushed, and no Release is created.
- The image runs **two processes** (backend API + Next.js server) behind one port in the current `Dockerfile`; that's fine for a single-container demo, but for production split them: the backend image needs only the `backend-builder` stage, and the dashboard bundle (or the Next.js standalone output) should be served separately.
- Versioning: tag ` vX.Y.Z` matches `docs/releases/vX.Y.md` notes when applicable.
