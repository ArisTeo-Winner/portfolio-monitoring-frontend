import type { NextConfig } from "next";

const distDir = process.env.NEXT_OUTPUT_DIR?.trim() || ".next";

// The Content-Security-Policy is generated per request in `src/middleware.ts`
// so `script-src` can carry a per-request nonce instead of 'unsafe-inline'. A
// static build-time header cannot mint that nonce, so CSP is intentionally
// absent from this list; the headers below remain static.
export const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  distDir,
  output: "standalone",
  reactStrictMode: true,
  // Prevent framework fingerprinting via X-Powered-By: Next.js
  poweredByHeader: false,
  experimental: {
    // Work around a Next.js devtools/segment explorer runtime bug observed in dev
    // that breaks route chunks with `__webpack_modules__[moduleId] is not a function`.
    devtoolSegmentExplorer: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
