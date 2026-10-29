import { afterEach, describe, expect, it } from "vitest";
import { extractBackendRefreshToken } from "../bff-cookies";

/**
 * Build a minimal Response-like object whose Set-Cookie headers are exposed via
 * `getSetCookie()` (the undici accessor used by the helper's primary path).
 */
function responseWithSetCookies(setCookies: string[]): Response {
  return {
    headers: {
      getSetCookie: () => setCookies,
      get: (name: string) =>
        name.toLowerCase() === "set-cookie" ? (setCookies[0] ?? null) : null,
    },
  } as unknown as Response;
}

/** Response-like object WITHOUT getSetCookie — exercises the single-header fallback. */
function responseWithSingleHeader(setCookie: string | null): Response {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "set-cookie" ? setCookie : null,
    },
  } as unknown as Response;
}

const originalEnv = process.env.BACKEND_REFRESH_COOKIE;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.BACKEND_REFRESH_COOKIE;
  } else {
    process.env.BACKEND_REFRESH_COOKIE = originalEnv;
  }
});

describe("extractBackendRefreshToken", () => {
  it("returns the value of the single cookie the backend sets", () => {
    const response = responseWithSetCookies([
      "cpm_refresh=abc.def.ghi; Path=/; HttpOnly; SameSite=Strict",
    ]);
    expect(extractBackendRefreshToken(response)).toBe("abc.def.ghi");
  });

  it("preserves a value that itself contains '=' (base64 padding)", () => {
    const response = responseWithSetCookies([
      "refreshToken=eyJhbGciOi==; Path=/; HttpOnly",
    ]);
    expect(extractBackendRefreshToken(response)).toBe("eyJhbGciOi==");
  });

  it("matches the exact name from BACKEND_REFRESH_COOKIE when set", () => {
    process.env.BACKEND_REFRESH_COOKIE = "myRt";
    const response = responseWithSetCookies([
      "session=xyz; Path=/",
      "myRt=the-refresh; Path=/; HttpOnly",
      "csrf=token; Path=/",
    ]);
    expect(extractBackendRefreshToken(response)).toBe("the-refresh");
  });

  it("returns null when the configured name is absent among multiple cookies", () => {
    process.env.BACKEND_REFRESH_COOKIE = "notThere";
    const response = responseWithSetCookies([
      "session=xyz; Path=/",
      "csrf=token; Path=/",
    ]);
    expect(extractBackendRefreshToken(response)).toBeNull();
  });

  it("falls back to the refresh-looking cookie among several (no env)", () => {
    delete process.env.BACKEND_REFRESH_COOKIE;
    const response = responseWithSetCookies([
      "JSESSIONID=abc; Path=/",
      "rt=the-refresh; Path=/; HttpOnly",
      "theme=dark; Path=/",
    ]);
    expect(extractBackendRefreshToken(response)).toBe("the-refresh");
  });

  it("returns null when there is no Set-Cookie header", () => {
    expect(extractBackendRefreshToken(responseWithSetCookies([]))).toBeNull();
    expect(extractBackendRefreshToken(responseWithSingleHeader(null))).toBeNull();
  });

  it("uses the single-header fallback when getSetCookie is unavailable", () => {
    const response = responseWithSingleHeader(
      "cpm_refresh=fallback-value; Path=/; HttpOnly",
    );
    expect(extractBackendRefreshToken(response)).toBe("fallback-value");
  });
});
