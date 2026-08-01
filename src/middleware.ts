import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security/content-security-policy";

/**
 * Mints a cryptographically-random, base64-encoded nonce for a single request.
 * Uses the Web Crypto `getRandomValues` available in the Edge runtime.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  // Expose the CSP (and nonce) on the *request* headers so Next.js reads the
  // nonce and stamps it onto its own inline hydration scripts as it renders.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set the CSP on the *response* so the browser actually enforces it.
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except:
     * - api            (Route Handlers, no HTML/scripts to protect)
     * - _next/static   (immutable build assets)
     * - _next/image    (optimized images)
     * - favicon.ico    (static icon)
     * and skip prefetch requests, which never render script tags.
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
