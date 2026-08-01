import nextConfig, { securityHeaders } from "../../next.config";
import { buildContentSecurityPolicy } from "@/lib/security/content-security-policy";

describe("frontend security headers", () => {
  it("configures the AppSec header baseline for every route", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");

    const routeHeaders = await nextConfig.headers?.();
    const globalHeaders = routeHeaders?.find((entry) => entry.source === "/:path*");

    expect(globalHeaders).toBeDefined();
    expect(globalHeaders?.headers).toEqual(securityHeaders);
  });

  it("includes the required AppSec checklist headers", () => {
    const headerMap = new Map(securityHeaders.map((header) => [header.key, header.value]));

    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Permissions-Policy")).toContain("geolocation=()");
    expect(headerMap.get("Permissions-Policy")).toContain("microphone=()");
  });

  it("does not ship a static Content-Security-Policy header", () => {
    // CSP is minted per request in src/middleware.ts so it can carry a nonce;
    // a static build-time header cannot, so it must not be in this list.
    const keys = securityHeaders.map((header) => header.key);
    expect(keys).not.toContain("Content-Security-Policy");
  });
});

describe("per-request Content-Security-Policy", () => {
  it("uses a nonce and drops 'unsafe-inline' from script-src", () => {
    const csp = buildContentSecurityPolicy("abc123==");

    const scriptSrc = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src "));

    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'nonce-abc123=='");
    // The whole point of the fix: no 'unsafe-inline' in script-src.
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("preserves the rest of the security baseline", () => {
    const csp = buildContentSecurityPolicy("nonce-value");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    // style-src keeps its own 'unsafe-inline' (out of scope for this change).
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("keeps connect-src minimal (no third-party price hosts)", () => {
    const csp = buildContentSecurityPolicy("nonce-value");

    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("coingecko");
    expect(csp).not.toContain("coinmarketcap");
  });
});
