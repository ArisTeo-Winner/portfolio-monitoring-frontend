# Frontend Quality Gate — Definition of Done

**Scope:** Every pull request that targets `main` or `develop`.  
**Enforcement:** `frontend-ci.yml` — all jobs must pass before merge is allowed.  
**Owner:** Frontend team. Updated when new test suites or policies are added.

---

## 1. Mandatory Gate Commands

All seven commands must exit 0. A single failure blocks the PR.

| # | Command | Validates |
|---|---|---|
| 1 | `npm run lint` | ESLint — zero warnings, zero errors |
| 2 | `npm run typecheck` | TypeScript strict — zero type errors |
| 3 | `npm run test` | Vitest unit + integration suite |
| 4 | `npm run build:isolated` | Production build in isolated `NEXT_OUTPUT_DIR` |
| 5 | `npm audit --audit-level=high` | Zero high/critical CVEs |
| 6 | `npx playwright test --project=xs-mobile` | Full functional E2E at 375×812 |
| 7 | `npx playwright test tests/e2e/settings-responsive-density.spec.ts` | Fintech Density at all 5 breakpoints |

Quick local equivalent:

```bash
npm run quality        # lint + typecheck + test + build:isolated
npm run security:deps  # npm audit --audit-level=high
npx playwright test --project=xs-mobile
npx playwright test tests/e2e/settings-responsive-density.spec.ts
```

---

## 2. When to Run Each Test Type

| Test suite | Every PR | UI change¹ | Security change | Pre-release / RC |
|---|:---:|:---:|:---:|:---:|
| `lint` | ✓ | ✓ | ✓ | ✓ |
| `typecheck` | ✓ | ✓ | ✓ | ✓ |
| `npm audit` | ✓ | ✓ | ✓ | ✓ |
| Vitest unit tests | ✓ | ✓ | ✓ | ✓ |
| E2E `xs-mobile` (functional) | ✓ | ✓ | ✓ | ✓ |
| E2E `security.spec.ts` | ✓ | ✓ | ✓ | ✓ |
| E2E `settings-responsive-density` | ✓ | ✓ | ✓ | ✓ |
| Visual regression snapshots | — | ✓ | — | ✓ |
| Full E2E (all 5 projects) | — | — | — | ✓ |
| Smoke tests (deployed env) | — | — | — | ✓ post-deploy |

¹ "UI change" = any PR that modifies `.tsx`, `.css`, Tailwind classes, layout files,
or component stories. When in doubt, run visual regression.

---

## 3. Blocking Rules

### 3.1 Always Blocking

A PR is automatically blocked if any of the following is true, regardless of PR type or priority:

```
✗  npm run lint exits non-zero
✗  npm run typecheck exits non-zero
✗  npm run test has any failure or timeout
✗  npm run build:isolated fails
✗  npm audit reports high or critical CVE without documented exception
✗  Any xs-mobile E2E test fails after CI retries (2 retries configured)
✗  settings-responsive-density.spec.ts fails on any project
```

### 3.2 Security Blocking (P0)

The following are **hard blocks**. No exception process exists for these:

```
✗  JWT-like value (eyJ...) found in DOM, localStorage, or sessionStorage
✗  Refresh token found in localStorage or sessionStorage
✗  Authorization header value found in console.log output
✗  Real API key or secret in any NEXT_PUBLIC_ variable
✗  Real .env credentials committed to the repository
✗  401 does not purge session state and redirect to /login
✗  Protected route accessible without an active session
✗  OAuth2 callback can loop infinitely
✗  Backend stack trace rendered in the browser
✗  X-Powered-By header present in HTTP responses
```

All of the above are covered by `tests/e2e/security.spec.ts`.

### 3.3 Visual Regression Blocking

```
✗  Playwright snapshot updated (committed) without explicit reviewer sign-off
   in the PR description ("Visual change reviewed: [screenshot name]")
✗  Snapshot pixel diff > 5% without documented intentional UI change
```

To update snapshots intentionally:

```bash
# Generate new Linux baselines (run in CI or Linux environment)
npx playwright test --update-snapshots
# Then commit the new *-linux.png files and note in PR description
```

### 3.4 Coverage Blocking

```
✗  Critical module coverage drops below 80%
```

Critical modules (coverage measured in `npm run test:coverage`):

```
src/lib/api/client.ts          — HTTP interceptor
src/state/session.store.ts     — token storage
src/features/auth/lib/         — auth client, session helpers
src/components/layout/         — protected route guard
```

---

## 4. Severity Matrix

Severity determines urgency, escalation path, and whether a PR is blocked or warned.

### P0 — Auth / Session / Security
**Effect: Hard block. No merge. No exceptions.**

Includes any issue that could expose user credentials, bypass authentication,
or allow unauthorized access.

| Scenario | Detected by |
|---|---|
| 401 does not clear session | `security.spec.ts`, `session.spec.ts` |
| JWT in DOM or localStorage | `security.spec.ts` |
| Refresh token accessible from JS | `security.spec.ts` |
| Authorization header in console | `security.spec.ts` |
| Protected route accessible without session | `session.spec.ts` |
| OAuth2 callback infinite loop | `oauth2.spec.ts` |
| Backend stack trace rendered | `security.spec.ts` |
| `X-Powered-By` header present | `smoke.spec.ts` |

### P1 — Portfolio / Transactions / Settings Critical UX
**Effect: Hard block. PR must be fixed before merge.**

Includes any regression in a primary user flow that makes the app
non-functional for a user on the primary 375×812 viewport.

| Scenario | Detected by |
|---|---|
| Portfolio balance doesn't render | `portfolio.spec.ts` |
| Asset list missing on mobile | `portfolio.spec.ts` |
| Transaction list fails to load | `transactions.spec.ts` |
| Login form submit broken | `auth.spec.ts` |
| Settings save silently fails | E2E / manual |
| 403 crashes the app | `security.spec.ts` |
| Empty state missing (infinite spinner) | Functional E2E |
| API failure state missing | Functional E2E |
| Fintech Density violation (row > 40px / card > 60px) | `settings-responsive-density.spec.ts` |

### P2 — Visual Polish
**Effect: Warn on CI. Block only if a snapshot regression test fails.**

Includes cosmetic issues that do not affect functionality or accessibility.

| Scenario | Action |
|---|---|
| Spacing slightly off the design system | Fix before merge if fast, else file issue |
| Typography 1–2px off scale | File issue, fix in follow-up |
| Hover state inconsistency | File issue |
| Icon sizing not matching spec | File issue |
| Snapshot diff within tolerance (< 5%) but visible | Document in PR, reviewer approves |

### P3 — Refactor / No Behavior Change
**Effect: Standard code review. No extra gates required.**

Includes changes with zero user-facing impact.

| Scenario |
|---|
| Extracting a utility function |
| Renaming an internal type or interface |
| Adding or updating a comment |
| Adjusting a type assertion |
| Performance micro-optimization with no UX change |

---

## 5. PR Checklist

Copy and paste this block into every PR description.
Check each item before requesting review.

```markdown
## Quality Gate Checklist

### Build & Static Analysis
- [ ] `npm run lint` — 0 warnings, 0 errors
- [ ] `npm run typecheck` — 0 type errors
- [ ] `npm run build:isolated` — build succeeds

### Tests
- [ ] `npm run test` — 0 failures
- [ ] `npx playwright test --project=xs-mobile` — 0 failures
- [ ] `npx playwright test tests/e2e/settings-responsive-density.spec.ts` — 0 failures

### Security
- [ ] `npm audit --audit-level=high` — 0 high/critical CVEs
- [ ] `npx playwright test tests/e2e/security.spec.ts --project=xs-mobile` — 12/12 pass
- [ ] No JWT or refresh token in DOM / localStorage / sessionStorage
- [ ] No Authorization header in console logs
- [ ] No real secrets in any NEXT_PUBLIC_ variable
- [ ] No real .env values committed

### Visual (UI changes only)
- [ ] No snapshot changes, OR
- [ ] Snapshots updated and each changed screenshot listed below with reviewer sign-off

**Changed screenshots (if any):**
<!-- List each updated snapshot and confirm it was visually reviewed -->
<!-- Example: `login-dialog-mobile.png` — button label copy change, reviewed ✓ -->

### Severity Self-Assessment
- [ ] P0 issues: 0
- [ ] P1 regressions: 0
- [ ] P2 issues documented (if any): <!-- link to issues -->
```

---

## 6. Local Commands Before Pushing

Run these locally before opening a PR to catch everything CI would catch:

```bash
# 1. Static validation
npm run lint
npm run typecheck

# 2. Unit tests
npm run test

# 3. Production build
npm run build:isolated

# 4. Dependency audit
npm audit --audit-level=high

# 5. E2E xs-mobile (functional + security)
npx playwright test --project=xs-mobile

# 6. Responsive density
npx playwright test tests/e2e/settings-responsive-density.spec.ts

# 7. Security spec in isolation (fast feedback)
npx playwright test tests/e2e/security.spec.ts --project=xs-mobile

# 8. Visual regression — only if you changed UI
npx playwright test tests/e2e/settings-visual.spec.ts --project=xs-mobile
```

Single-command equivalent (matches `quality:ci`):

```bash
npm ci && \
npm run lint && \
npm run typecheck && \
npm run test && \
npm run build:isolated && \
npm run security:deps
```

Then E2E separately (requires the dev server):

```bash
npx playwright test --project=xs-mobile && \
npx playwright test tests/e2e/settings-responsive-density.spec.ts
```

---

## 7. Merge Criteria

A PR is mergeable **only** when all of the following are true:

### Automated Gates (enforced by `frontend-ci.yml`)
- [ ] `quality` job: green (lint + typecheck + test + build + audit)
- [ ] `e2e-xs` job: green (all xs-mobile Playwright tests pass)
- [ ] `e2e-responsive` job: green (density spec passes all 5 projects)

### Human Review Gate
- [ ] At least **1 approval** from a team member
- [ ] PR description includes the Quality Gate Checklist, fully checked
- [ ] All P0 and P1 issues are resolved (not deferred)
- [ ] Any snapshot changes have explicit visual sign-off in the PR description

### Conditional Gates
- [ ] If the PR touches `src/lib/api/client.ts`, `session.store.ts`, or any
  auth file: `e2e-xs` result for `security.spec.ts` must be reviewed
  individually, not just the aggregate pass.
- [ ] If the PR adds a new `NEXT_PUBLIC_` variable: confirm it contains no
  credentials and is documented in `docs/deploy/frontend-deploy.md`.
- [ ] If the PR updates Playwright snapshots: each updated file must be named
  explicitly in the PR description with reviewer sign-off.

---

## 8. Exception Process

In rare cases, a failing gate may be accepted with justification. The process:

1. Open a separate issue labeled `quality-gate-exception`.
2. Document: which gate failed, why it was accepted, and the remediation plan.
3. Set a due date for the fix (maximum 1 sprint).
4. Tag the PR with `exception-approved` after lead sign-off.

**Exceptions are never valid for P0 security issues.**

---

## 9. Coverage Targets

| Module type | Minimum coverage | Notes |
|---|---|---|
| Critical (auth, session, interceptor) | 90% | Enforced |
| Feature modules (portfolio, transactions) | 80% | Enforced |
| UI components | 70% | Guidance, not hard gate |
| Utilities | 80% | Enforced |
| E2E helpers | — | Covered by the specs that use them |

Run coverage report:

```bash
npm run test:coverage
# Report at coverage/index.html
```

---

## 11. Spec-to-Project Execution Standard

This section is the authoritative reference for which Playwright specs run on which projects.
**Never run xs-mobile-targeted specs across all projects.** Doing so produces false failures,
stale snapshot conflicts, and meaningless coverage data for layout contracts that only apply at 375px.

### xs-mobile (375×812) — Functional and Security authority

The specs below run **exclusively** on `xs-mobile`. Their assertions (card heights, touch targets,
Fintech Density row heights, mobile-card visibility) are calibrated for a 375px wide viewport.
Running them on wider projects is incorrect and will produce misleading results.

```
auth.spec.ts              login flow (375×812 primary target)
oauth2.spec.ts            OAuth2 callback flows
session.spec.ts           session persistence, 401 purge, logout
portfolio.spec.ts         portfolio rendering + security assertions
transactions.spec.ts      transaction history, Fintech Density
security.spec.ts          12 tests: token storage, DOM, console, 401, 403
ux-states.spec.ts         loading / empty / error UX states
accessibility.spec.ts     axe-core accessibility audit
```

CI command:
```bash
npx playwright test --project=xs-mobile
```

### All 5 projects (xs / sm / md / lg / xl) — Responsive authority

This is the **only** spec that must run on all 5 projects. It validates layout density,
card heights, and touch targets at every official breakpoint.

```
settings-responsive-density.spec.ts   Fintech Density at all 5 breakpoints
```

CI command:
```bash
npx playwright test tests/e2e/settings-responsive-density.spec.ts
```

### Visual regression — snapshot-first policy

A visual spec may only run on a project once stable baselines exist for that project.
Snapshots are stored under `tests/e2e/<spec>-snapshots/` and committed to the repository.

| Spec | xs-mobile | sm-large-mobile | md-tablet | lg-small-desktop | xl-desktop |
|---|:---:|:---:|:---:|:---:|:---:|
| `settings-visual.spec.ts` | ✓ stable | ✓ stable | ✓ stable | ✓ stable | ✓ stable |
| `visual-regression.spec.ts` | ✓ stable | ✓ stable | ✓ stable | ✓ stable | ✓ stable |

To establish baselines for a new project:
```bash
npx playwright test <spec> --project=<new-project> --update-snapshots
# Review every generated screenshot, then commit with sign-off in the PR description
```

When UI changes cause snapshot mismatches, update **only** the affected projects:
```bash
npx playwright test <spec> --project=<affected-project> --update-snapshots
```

### Rule: preserve xs-mobile guards

Tests that assert 375px contracts are guarded at the spec level with `skipUnlessXsMobile`,
`skipUnlessMobile`, or `test.skip(...)`. These guards must never be removed to make a
wider-viewport run pass. If a wider-viewport assertion is needed, write a new test scoped
to the correct project.

---

## 10. CI/CD Job Reference

| Job | Trigger | Blocks |
|---|---|---|
| `quality` | Every PR + push | All downstream jobs |
| `e2e-xs` | After `quality` passes | `container-smoke` |
| `e2e-responsive` | After `quality` passes | — (parallel) |
| `security-snyk` | After `quality` passes | — (if `SNYK_TOKEN` set) |
| `container-smoke` | After `quality` + `e2e-xs` | — |
| `deploy-preview-smoke` | Manual / deployment event | — |

Workflow file: `.github/workflows/frontend-ci.yml`  
Smoke config: `playwright.smoke.config.ts`  
Deploy docs: `docs/deploy/frontend-deploy.md`
