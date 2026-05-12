# Frontend Operations: Portfolio Monitoring

## 1. Tech Stack

- Framework: React + Vite
- Language: TypeScript
- Styling: Tailwind CSS with Fintech Density Theme
- API Client: Axios / Fetch with centralized HTTP client/interceptor layer
- Form Validation: Zod / React Hook Form
- E2E Testing: Playwright
- Unit / Integration Testing: Vitest or Jest + Testing Library
- Visual Regression: Playwright screenshots

---

## 2. Debug Captures Policy

All screenshots and DOM analysis exports produced during debugging sessions must be saved under:

```
debug-captures/
```

This directory is gitignored. Never write `.png`, `.json` analysis files, or metrics exports directly to the project root.

Naming convention inside `debug-captures/`:

```
debug-captures/<feature>-<viewport>-<description>.<ext>
debug-captures/<feature>-<viewport>-analysis.json

Examples:
  debug-captures/portfolio-xs-mobile-balance-check.png
  debug-captures/transactions-xs-mobile-density-analysis.json
  debug-captures/settings-account-desktop-check.png
```

## 3. SDLC Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
npx playwright test
npx playwright test --ui
npx playwright show-report
```

Use snapshot updates only when the visual change is intentional and reviewed:

```bash
npx playwright test --update-snapshots
```

---

## 4. Frontend Architecture & DesignOps

Use Atomic Design as the default UI organization model.

Recommended structure:

```text
src/
  components/
    atoms/
    molecules/
    organisms/
    templates/
  features/
    auth/
    portfolio/
    transactions/
    market-data/
  pages/
  routes/
  services/
  stores/
  hooks/
  utils/
  types/
```

Breakpoint contract:

```text
xs: 0px      Default mobile target
sm: 640px    Large mobile
md: 768px    Tablet
lg: 1024px   Small desktop
xl: 1280px+  Desktop
```

Primary mobile testing target:

```text
375x812
```

All critical flows must be verified at this viewport.

---

## 5. Fintech Density Rules

The UI must follow a compact financial dashboard style.

Rules:

- Preferred table row height: max `40px`.
- Accepted mobile transaction card height: max `60px`.
- Recommended paddings: `py-1`, `py-2`, `px-2`, `px-3`.
- Primary financial data: `text-sm`.
- Metadata: `text-[10px]` or `text-xs`.
- Avoid oversized text in dense financial tables.
- Avoid excessive vertical spacing in portfolio, transaction, and market-data views.

Required Playwright checks:

```text
- Transaction rows/cards are visible in mobile viewport.
- Row/card height does not exceed the approved threshold.
- Primary typography does not exceed 14px.
- Critical dashboard content fits in 375x812 without broken layout.
```

---

## 6. DevSecOps Client-Side Policy

### Token Storage Policy

Access token:

```text
- Prefer memory-first storage.
- sessionStorage may only be used if session restore is explicitly required.
- Never store access tokens in localStorage.
```

Refresh token:

```text
- Must be stored only as HttpOnly cookie from the backend.
- Must never be accessible from JavaScript.
- Must never be stored in localStorage.
- Must never be stored in sessionStorage.
- Must never be rendered in the DOM.
```

Refresh-token cookie requirements:

```text
HttpOnly
Secure
SameSite=Lax or SameSite=Strict depending on OAuth2 flow requirements
Path restricted when possible
Reasonable expiration time
```

The frontend must never expose the following in DOM, localStorage, sessionStorage, console logs, URLs, analytics, or user-facing errors:

```text
- JWTs
- refresh tokens
- Authorization headers
- API keys
- raw backend stack traces
- sensitive financial payloads
- unnecessary internal identifiers
```

Production frontend must not log:

```text
- JWTs
- Authorization headers
- refresh token data
- sensitive financial payloads
- raw authentication errors
```

---

## 7. Global HTTP Error Handling

All HTTP requests must pass through a centralized client layer, for example:

```text
src/services/apiClient.ts
src/services/httpClient.ts
src/features/auth/authClient.ts
```

### 401 Unauthorized

When the backend returns `401 Unauthorized`:

```text
1. Clear in-memory auth state.
2. Clear sessionStorage access token if used.
3. Clear user profile state.
4. Clear portfolio/transaction cached state.
5. Redirect to /login.
6. Avoid infinite redirect loops.
7. Show a controlled session-expired message when appropriate.
```

### 403 Forbidden

When the backend returns `403 Forbidden`:

```text
1. Do not expose raw backend errors.
2. Do not break the app.
3. Show a controlled "Access denied" message.
4. Redirect only if the current route is no longer allowed.
5. Preserve UX stability.
```

### 5xx Server Errors

When the backend returns `500`, `502`, `503`, or `504`:

```text
1. Show a controlled service-unavailable or retry message.
2. Do not expose stack traces.
3. Do not clear session automatically unless the backend explicitly returns 401.
4. Avoid infinite retry loops.
```

### Network Errors

When the API is unavailable:

```text
1. Show a controlled connectivity error.
2. Do not crash the route.
3. Do not expose implementation details.
4. Allow retry when appropriate.
```

---

## 8. Authentication and Session Requirements

### Standard Login Flow

The frontend must validate:

```text
- Login form renders correctly.
- Submit button is disabled with empty fields.
- Submit button enables when required fields are valid.
- Invalid email shows Zod/client-side validation error.
- Invalid credentials show controlled backend error.
- Successful login redirects to /portfolio.
- Login does not expose tokens in DOM or localStorage.
```

### Session Persistence

If refresh-cookie-based session recovery is supported, the frontend must validate:

```text
- User remains authenticated after page reload.
- Refresh endpoint is called when access token is missing or expired.
- Expired refresh session redirects to /login.
- Reload does not expose refresh token to JavaScript.
```

### Logout

The frontend must validate:

```text
- Logout calls the backend logout endpoint if available.
- Local auth state is cleared.
- sessionStorage is cleared if used.
- User is redirected to /login.
- Browser back button does not expose protected pages after logout.
```

---

## 9. OAuth2 Requirements

OAuth2 flows must be tested independently from standard JWT login.

Required OAuth2 scenarios:

```text
- Google login button is visible.
- Google login redirects to the backend OAuth2 authorization endpoint.
- OAuth2 callback success redirects to /portfolio.
- OAuth2 callback error redirects to /login with controlled error.
- OAuth2 cancel flow redirects to /login with controlled message.
- OAuth2 loading state prevents blank screens.
- OAuth2 callback does not create infinite redirects.
- OAuth2 callback does not expose tokens in URL, DOM, localStorage, sessionStorage, or console.
```

During callback processing, the UI must show a clear state:

```text
Signing in...
Processing login...
Redirecting...
```

Never leave the user on a blank callback page.

---

## 10. E2E Testing Strategy

Recommended test structure:

```text
tests/
  e2e/
    auth.spec.ts
    oauth2.spec.ts
    session.spec.ts
    portfolio.spec.ts
    transactions.spec.ts
    security.spec.ts
    visual.spec.ts
  fixtures/
    users.ts
    portfolio.mock.ts
    transactions.mock.ts
    auth.mock.ts
  support/
    auth.helper.ts
    selectors.ts
    routes.ts
    storage.helper.ts
```

E2E execution modes:

```text
1. Mocked E2E
   - Frontend only.
   - Uses Playwright page.route.
   - Deterministic and fast.

2. Integrated E2E
   - Frontend + real Spring Boot backend.
   - Uses test database or controlled staging data.
   - Validates real auth/session/portfolio flows.

3. Smoke E2E
   - Minimal critical path against deployed environment.
   - Validates login, portfolio load, and transaction visibility.
```

---

## 11. Playwright Selector Policy

Prefer stable selectors:

```tsx
data-testid="login-form"
data-testid="email-input"
data-testid="password-input"
data-testid="submit-login"
data-testid="portfolio-assets"
data-testid="portfolio-total-balance"
data-testid="transaction-table"
data-testid="logout-button"
data-testid="oauth2-google-button"
```

Avoid relying exclusively on:

```text
- Exact visual text that may appear multiple times.
- Styling-only CSS classes.
- Deep DOM structure.
- nth-child selectors.
```

Preferred example:

```ts
const assetsSection = page.getByTestId("portfolio-assets");

await expect(assetsSection.getByText("BTC")).toBeVisible();
await expect(assetsSection.getByText("ETH")).toBeVisible();
await expect(assetsSection.getByText("SOL")).toBeVisible();
```

Avoid:

```ts
await expect(page.getByText("ETH").first()).toBeVisible();
```

---

## 12. Required E2E Coverage

### Auth

```text
- Login form renders on mobile.
- Login button disabled with empty fields.
- Login button enabled with valid fields.
- Invalid email shows validation error.
- Invalid credentials show controlled error.
- Successful login redirects to /portfolio.
- Login page visual regression.
```

### Session

```text
- Reload keeps user authenticated when refresh cookie is valid.
- Expired session redirects to /login.
- 401 clears auth state and redirects to /login.
- Logout clears frontend state.
- Protected route redirects anonymous user to /login.
- Browser back button does not expose protected page after logout.
```

### OAuth2

```text
- Google login button is visible.
- OAuth2 success callback redirects to /portfolio.
- OAuth2 error callback redirects to /login.
- OAuth2 cancelled flow shows controlled message.
- OAuth2 callback loading state is visible.
- OAuth2 callback does not create infinite loop.
```

### Portfolio

```text
- Portfolio renders total balance.
- Portfolio renders BTC, ETH, SOL or configured mock assets.
- Portfolio renders distribution chart.
- Empty portfolio shows controlled empty state.
- Portfolio API failure shows controlled error state.
- Portfolio does not expose JWTs or sensitive data in the DOM.
- Portfolio visual regression on mobile.
```

### Transactions

```text
- Transaction history renders in mobile 375x812.
- Empty transaction history shows controlled empty state.
- Transaction row/card height follows Fintech Density policy.
- Primary transaction typography is <= 14px.
- API failure shows controlled error state.
- Transactions visual regression on mobile.
```

### Security

```text
- localStorage does not contain JWT.
- localStorage does not contain refresh token.
- sessionStorage does not contain refresh token.
- DOM does not contain JWT.
- DOM does not contain refresh token.
- Console does not log Authorization headers.
- Console does not log JWT-like values.
- 401 response purges session state.
- 403 response shows controlled access denied state.
```

### Visual Regression

```text
- Login mobile 375x812
- Portfolio mobile 375x812
- Transactions mobile 375x812
- OAuth2 callback loading state
- Empty portfolio state
- Empty transactions state
- API error state
```

---

## 13. Recommended Playwright Helpers

### Login Helper

```ts
import { expect, Page } from "@playwright/test";

export async function loginAsTestUser(page: Page) {
  await page.goto("/login");

  await page.getByTestId("email-input").fill("test@example.com");
  await page.getByTestId("password-input").fill("Password123!");
  await page.getByTestId("submit-login").click();

  await expect(page).toHaveURL(/\/portfolio/);
}
```

### Storage Security Helper

```ts
import { expect, Page } from "@playwright/test";

export async function expectNoSensitiveTokensInStorage(page: Page) {
  const localStorageDump = await page.evaluate(() => JSON.stringify(localStorage));
  const sessionStorageDump = await page.evaluate(() => JSON.stringify(sessionStorage));

  expect(localStorageDump).not.toMatch(/eyJ[a-zA-Z0-9_-]+\./);
  expect(localStorageDump).not.toMatch(/refresh/i);
  expect(sessionStorageDump).not.toMatch(/refresh/i);
}
```

### DOM Security Helper

```ts
import { expect, Page } from "@playwright/test";

export async function expectNoSensitiveTokensInDOM(page: Page) {
  const html = await page.content();

  expect(html).not.toMatch(/eyJ[a-zA-Z0-9_-]+\./);
  expect(html).not.toMatch(/refresh_token/i);
  expect(html).not.toMatch(/access_token/i);
}
```

---

## 14. CI/CD Frontend Quality Gate

A pull request must not be merged unless the following commands pass:

```bash
npm run lint
npm run build
npm run test
npx playwright test
```

The pipeline should preserve:

```text
- Playwright HTML report
- Screenshots
- Videos for failed tests
- Traces for failed tests
- Test summary
```

Recommended Playwright config:

```ts
use: {
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
  video: "retain-on-failure",
}
```

---

## 15. Definition of Done for Pull Requests

A frontend PR is complete only when all items below are satisfied.

### Build and Static Validation

```text
- npm run build passes.
- npm run lint passes.
- No TypeScript errors.
- No dead routes or broken imports.
```

### Unit and Integration Tests

```text
- All Vitest/Jest tests pass.
- Global coverage target: >= 80%.
- Critical modules coverage target: >= 90%.
```

Critical modules include:

```text
- auth client
- session handling
- protected route guard
- HTTP interceptor
- token storage logic
- OAuth2 callback handling
```

Do not enforce artificial 100% coverage unless the module is security-critical and small enough to justify it.

### Playwright E2E Suite

The following areas must be covered:

```text
- JWT login flow.
- OAuth2 success/error/cancel flows.
- Refresh-cookie session persistence.
- Logout.
- Protected route behavior.
- 401 global state purge and redirect to /login.
- 403 controlled access denied behavior.
- Portfolio distribution.
- Transaction history.
- Empty states.
- API failure states.
- Visual regression.
```

### DevSecOps Policy

The PR must verify:

```text
- 0 refresh tokens in localStorage.
- 0 refresh tokens in sessionStorage.
- 0 JWTs in localStorage.
- 0 sensitive tokens in the DOM.
- 0 Authorization headers in console logs.
- No raw backend stack traces shown to the user.
```

### UX Policy

The PR must verify:

```text
- No infinite redirect loops.
- No blank OAuth2 callback page.
- Clear loading state during auth/session checks.
- Clear error state for failed API requests.
- Clear empty states for portfolio and transactions.
- Mobile layout remains usable at 375x812.
```

### Visual Regression

The PR must include or preserve approved screenshots for:

```text
- Login mobile
- Portfolio mobile
- Transactions mobile
- OAuth2 callback loading
- Empty portfolio
- Empty transactions
- API error state
```

Snapshot updates are allowed only when the UI change is intentional and reviewed.

---

## 16. Current E2E Status

Current observed E2E suite status:

```text
14 passed
1 skipped
```

Covered areas:

```text
- Login flow
- Portfolio distribution
- Transaction history
- Fintech Density checks
- Basic visual regression
- Basic DOM sensitive-token exposure check
```

Pending areas for production-grade readiness:

```text
- OAuth2 success/error/cancel flows
- Refresh token persistence after reload
- 401 global state purge and redirect to /login
- 403 controlled access denied handling
- Logout state purge
- Protected route anonymous redirect
- localStorage/sessionStorage security assertions
- Console log sensitive-token detection
- Empty state tests
- API failure state tests
```

---

## 17. Priority Roadmap

### Priority 1: Security-Critical

```text
1. 401 clears auth state and redirects to /login.
2. localStorage does not contain JWT or refresh token.
3. sessionStorage does not contain refresh token.
4. DOM does not contain JWT or refresh token.
5. Logout clears session state.
```

### Priority 2: Session Reliability

```text
1. Reload keeps authenticated session when refresh cookie is valid.
2. Expired refresh session redirects to /login.
3. Protected route redirects anonymous user to /login.
4. Browser back button does not expose protected page after logout.
```

### Priority 3: OAuth2

```text
1. Google login button exists.
2. OAuth2 success callback redirects to /portfolio.
3. OAuth2 error callback redirects to /login.
4. OAuth2 cancelled flow shows controlled message.
5. OAuth2 callback loading state is visible.
6. OAuth2 callback has no infinite redirect loop.
```

### Priority 4: UX Resilience

```text
1. Empty portfolio state.
2. Empty transactions state.
3. Portfolio API failure state.
4. Transactions API failure state.
5. Controlled 403 access denied state.
```

### Priority 5: Visual Regression

```text
1. Login mobile.
2. Portfolio mobile.
3. Transactions mobile.
4. OAuth2 callback loading.
5. Empty states.
6. Error states.
```
