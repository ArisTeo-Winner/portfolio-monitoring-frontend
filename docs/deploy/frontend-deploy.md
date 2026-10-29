# Frontend Deployment Guide

## Platform

**Primary target: Render.com (Docker / standalone)**

This project uses `output: "standalone"` and ships as a Docker container.
There is no `vercel.json` or `netlify.toml` — Vercel/Netlify are viable
alternatives but require additional configuration noted below.

```
Dockerfile ──► Docker image ──► Render Web Service (port 3000)
```

---

## Environment Variables

All variables that begin with `NEXT_PUBLIC_` are **baked into the build
artifact at compile time** via Next.js static replacement. They are NOT
secrets and are visible in the browser bundle. Do not put sensitive values
in them.

### Required

| Variable | Example | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://crypto-portfolio-monitoring.onrender.com` | BFF → backend URL. Used for CSP `connect-src` and API calls. Must be HTTPS in production. |
| `NEXT_PUBLIC_APP_URL` | `https://cpm-frontend.onrender.com` | Used by `ensureClientRuntimeConfig()` to validate the browser origin matches the build target. If omitted, the origin check is skipped (acceptable for preview deploys). |

### Runtime-only (server-side, never in NEXT_PUBLIC_)

These variables are consumed server-side by Next.js API routes only.
They are never exposed to the browser.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set to `production` by the Dockerfile runner stage. |
| `NEXT_TELEMETRY_DISABLED` | Set to `1` in the Dockerfile to opt out of telemetry. |
| `PORT` | Container listen port. Defaults to `3000`. |

### What NOT to put in NEXT_PUBLIC_

```
✗ NEXT_PUBLIC_JWT_SECRET      — never
✗ NEXT_PUBLIC_DB_PASSWORD     — never
✗ NEXT_PUBLIC_STRIPE_SECRET   — never
✓ NEXT_PUBLIC_API_BASE_URL    — safe (URL, not a credential)
✓ NEXT_PUBLIC_APP_URL         — safe (URL, not a credential)
```

---

## Render.com Setup

### New Web Service

1. Connect the GitHub repo.
2. Select **Docker** as the environment.
3. Set the following build args under **Environment → Environment Variables**:

```
NEXT_PUBLIC_API_BASE_URL = https://crypto-portfolio-monitoring.onrender.com
NEXT_PUBLIC_APP_URL      = https://<your-service-name>.onrender.com
```

4. Set **Port** to `3000`.
5. Set **Health Check Path** to `/api/health`.
6. Enable **Auto-Deploy** on push to `main`.

### Auto-Deploy Gate

Render auto-deploy runs after GitHub push. To ensure the quality gate
blocks a bad deploy before Render triggers:

```
Push → GitHub Actions (quality gate) → Render auto-deploy
```

Configure Render to deploy only from `main` and protect `main` with
a required status check (`quality` job in `frontend-ci.yml`).

### Preview Deploys

Render does not natively create preview URLs per PR the way Vercel does.
To run smoke tests against a Render preview:

1. Manually trigger the `deploy-preview-smoke.yml` workflow:
   - Input `preview_url`: the Render preview service URL.
2. Or set up a Render deploy hook and call it from a GitHub Actions step.

---

## Docker Build (local / manual)

```bash
# Build
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://crypto-portfolio-monitoring.onrender.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://cpm-frontend.onrender.com \
  -t cpm-frontend:latest .

# Run
docker run -d --rm \
  -p 3000:3000 \
  --name cpm-frontend \
  cpm-frontend:latest

# Health check
curl http://localhost:3000/api/health
```

---

## Vercel (Alternative)

If the team migrates to Vercel, disable `output: "standalone"` in
`next.config.ts` (Vercel manages its own output format) and add a
`vercel.json`:

```json
{
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "@next-public-api-base-url",
    "NEXT_PUBLIC_APP_URL": "@next-public-app-url"
  }
}
```

Set `@next-public-api-base-url` and `@next-public-app-url` as Vercel
environment variable references in the project dashboard.

Vercel creates preview URLs per PR automatically — smoke tests can target
the `VERCEL_URL` environment variable:

```yaml
# In GitHub Actions after Vercel deploy action
- name: Run smoke tests
  run: npm run test:e2e:smoke
  env:
    PLAYWRIGHT_BASE_URL: https://${{ steps.vercel-deploy.outputs.preview-url }}
```

---

## Netlify (Alternative)

Add `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NEXT_PUBLIC_API_BASE_URL = "https://crypto-portfolio-monitoring.onrender.com"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Note: Netlify requires the `@netlify/plugin-nextjs` plugin for full
Next.js API route support (BFF auth routes require server-side execution).

---

## Smoke Tests

### Purpose

Smoke tests are fast, unauthenticated checks that verify the deployed
instance is alive and serving correct responses. They do NOT mock any
routes — they hit the real server.

### Run locally against any environment

```bash
# Against staging
PLAYWRIGHT_BASE_URL=https://cpm-frontend.onrender.com npm run test:e2e:smoke

# Against a preview URL
PLAYWRIGHT_BASE_URL=https://cpm-frontend-pr-42.onrender.com npm run test:e2e:smoke

# Against local Docker container
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:smoke
```

### What smoke tests verify

| Check | Spec group |
|---|---|
| `GET /login` returns 200 and renders | Page availability |
| `GET /` does not crash (200 or 3xx) | Page availability |
| `/portfolio` redirects to `/login` (no session) | Auth guard |
| `/transactions` redirects to `/login` (no session) | Auth guard |
| `/api/health` returns `{ status, durationMs }` | Health endpoint |
| `/_next/static/*.js` bundles are served | Static assets |
| `X-Frame-Options: DENY` present | Security headers |
| `X-Content-Type-Options: nosniff` present | Security headers |
| `Content-Security-Policy` present | Security headers |
| `X-Powered-By` absent | Security headers |
| No critical JS errors on load | Console health |

### NEXT_PUBLIC_APP_URL in preview deploys

`ensureClientRuntimeConfig()` validates the browser origin against
`NEXT_PUBLIC_APP_URL`. If the deployed build has a staging URL baked in
and smoke tests target a different preview URL, any authenticated API
call would throw an origin mismatch error.

Mitigation options:
1. Leave `NEXT_PUBLIC_APP_URL` unset in the preview build (check is skipped).
2. Set `NEXT_PUBLIC_APP_URL` to the preview URL at build time.
3. Smoke tests are unauthenticated — the check is never triggered.

---

## Rollback

### Render.com

1. **Instant rollback via dashboard:**
   - Render → Service → Deploys → select the last known-good deploy → **Redeploy**.
   - Takes ~2 minutes.

2. **Git-based rollback:**
   ```bash
   # Revert the offending commit
   git revert <bad-commit-sha>
   git push origin main
   # Render auto-deploys the revert
   ```

3. **Suspend and redirect (emergency):**
   - Render → Service → Settings → **Suspend** to take the service offline.
   - Update DNS to a maintenance page while investigating.

### Docker / self-hosted

```bash
# Tag the last known-good image before deploying
docker tag cpm-frontend:latest cpm-frontend:rollback

# If the new deploy fails, restore immediately
docker stop cpm-frontend
docker run -d --rm -p 3000:3000 --name cpm-frontend cpm-frontend:rollback
```

### Verify after rollback

```bash
# Run smoke tests against the rolled-back instance to confirm it is healthy
PLAYWRIGHT_BASE_URL=https://cpm-frontend.onrender.com npm run test:e2e:smoke
```

---

## CI/CD Flow Summary

```
PR opened
  │
  ▼
frontend-ci.yml
  ├── quality  (lint · typecheck · test · build · audit)
  ├── e2e-xs   (Playwright xs-mobile)
  ├── e2e-responsive (density spec)
  └── container-smoke (Docker build + /login health)
  │
  ▼ (on push to main, after all jobs pass)
Render auto-deploy
  │
  ▼ (manual trigger or post-deploy hook)
deploy-preview-smoke.yml
  └── smoke tests (playwright.smoke.config.ts)
```

---

## Secrets Reference

| Name | Where | Required for |
|---|---|---|
| `SNYK_TOKEN` | GitHub repo secret | `security-snyk` CI job |
| `SNYK_ORG_ID` | GitHub repo variable | `security-snyk` CI job |
| `NEXT_PUBLIC_API_BASE_URL` | GitHub repo variable + Render env | All jobs + production |
| `NEXT_PUBLIC_APP_URL` | GitHub repo variable + Render env | Build artifact + runtime validation |
