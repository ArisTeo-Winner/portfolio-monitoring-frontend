import { http, HttpResponse } from "msw";
import { authFixtures } from "./fixtures/auth";
import { portfolioFixtures } from "./fixtures/portfolio";
import { transactionFixtures } from "./fixtures/transactions";
import { settingsFixtures } from "./fixtures/settings";

// MSW intercepts fetch("/api/auth/...") (relative URLs from Next.js route handlers)
// as http://localhost/api/auth/... in jsdom.
// Backend API calls use http://localhost:8080/api/v1/... (env.apiBaseUrl default).

export const handlers = [
  // ── Auth (Next.js BFF route handlers) ────────────────────────────────────
  http.post("http://localhost/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === authFixtures.validEmail && body.password === authFixtures.validPassword) {
      return HttpResponse.json({ accessToken: authFixtures.accessToken });
    }

    return HttpResponse.json(
      { detail: "Credenciales invalidas.", status: 401, title: "Unauthorized" },
      { status: 401 },
    );
  }),

  http.post("http://localhost/api/auth/refresh", () => {
    return HttpResponse.json({ accessToken: authFixtures.accessToken });
  }),

  // ── Portfolio (Spring Boot backend via apiRequest) ────────────────────────
  http.get("http://localhost:8080/api/v1/me/portfolio", () => {
    return HttpResponse.json(portfolioFixtures.entries);
  }),

  // ── Transactions ──────────────────────────────────────────────────────────
  http.get("http://localhost:8080/api/v1/me/transactions", () => {
    return HttpResponse.json(transactionFixtures.list);
  }),

  // ── Settings – Account ────────────────────────────────────────────────────
  http.get("http://localhost:8080/api/v1/users/me", () => {
    return HttpResponse.json(settingsFixtures.account);
  }),

  // ── Settings – Sessions ───────────────────────────────────────────────────
  http.get("http://localhost:8080/api/v1/me/sessions", () => {
    return HttpResponse.json(settingsFixtures.sessions);
  }),
];
