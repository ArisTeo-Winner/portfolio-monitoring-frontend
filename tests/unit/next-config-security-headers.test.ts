import nextConfig, { securityHeaders } from "../../next.config";

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

    expect(headerMap.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headerMap.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headerMap.get("Content-Security-Policy")).toContain("connect-src 'self'");
    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Permissions-Policy")).toContain("geolocation=()");
    expect(headerMap.get("Permissions-Policy")).toContain("microphone=()");
  });
});
