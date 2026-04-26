import type { NextConfig } from "next";

const distDir = process.env.NEXT_OUTPUT_DIR?.trim() || ".next";

function resolveApiOrigin(): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return "http://localhost:8080";
  }
}

function buildContentSecurityPolicy(): string {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const scriptSources = ["'self'", "'unsafe-inline'"];
  const connectSources = ["'self'", resolveApiOrigin(), "https://api.coingecko.com"];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("ws:", "wss:");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
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
