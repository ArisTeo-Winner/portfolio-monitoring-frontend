import { encodeBmvSymbol } from "@/lib/utils/currency";

export const endpoints = {
  // Spring Boot backend endpoints (called server-side by the BFF route handlers,
  // and directly by the API client for authorized data requests).
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/users/register",
    logout: "/api/v1/auth/logout",
    refresh: "/api/v1/tokens/refresh",
  },
  // First-party BFF route handlers (src/app/api/auth/*), same-origin. These own
  // the `cpm.rt` HttpOnly cookie; the browser talks to these, never to the
  // backend origin, for the token lifecycle.
  bff: {
    login: "/api/auth/login",
    refresh: "/api/auth/refresh",
    logout: "/api/auth/logout",
    // Same-origin proxy for the transactions list — forwards to the backend and
    // enriches crypto logoUrl server-side (src/app/api/me/transactions/route.ts).
    transactions: "/api/me/transactions",
  },
  users: {
    me: "/api/v1/users/me",
  },
  settings: {
    account: "/api/v1/users/me",
    changePassword: "/api/v1/users/password/change",
    sessions: "/api/v1/me/sessions",
    session: (sessionId: string) => `/api/v1/me/sessions/${encodeURIComponent(sessionId)}`,
    preferences: "/api/v1/me/preferences",
  },
  portfolio: {
    me: "/api/v1/me/portfolio",
    bySymbol: (symbol: string) => `/api/v1/me/portfolio/${encodeBmvSymbol(symbol)}`,
    holdingsPerformance: (portfolioId: string) =>
      `/api/v1/me/portfolio/${encodeURIComponent(portfolioId)}/holdings-performance`,
    history: "/api/v1/me/portfolio/history",
    assetHistory: (symbol: string) =>
      `/api/v1/me/portfolio/assets/${encodeURIComponent(symbol)}/history`,
    assetMarkers: (symbol: string) =>
      `/api/v1/me/portfolio/assets/${encodeURIComponent(symbol)}/markers`,
    cetesMarkToMarket: (transactionId: string) =>
      `/api/v1/portfolio/cetes/${encodeURIComponent(transactionId)}/mark-to-market`,
  },
  transactions: {
    me: "/api/v1/me/transactions",
    byId: (transactionId: string) => `/api/v1/me/transactions/${transactionId}`,
    details: (transactionId: string) => `/api/v1/me/transactions/details/${transactionId}`,
    buy: "/api/v1/me/transactions/buy",
    sell: "/api/v1/me/transactions/sell",
    transfer: "/api/v1/me/transactions/transfer",
    dividend: "/api/v1/me/transactions/dividend",
  },
  assets: {
    search: "/api/v1/assets/search",
    popular: "/api/v1/assets/popular",
    byType: "/api/v1/assets",
  },
  marketdata: {
    cryptoPrice: (symbol: string) => `/api/v1/crypto/${symbol}/price`,
    stockPrice: (symbol: string) => `/api/v1/marketdata/stock?symbol=${encodeURIComponent(symbol)}`,
    bmvHistorical: (symbol: string, from: string, to: string) =>
      `/api/v1/marketdata/bmv/historical/${encodeBmvSymbol(symbol)}?from=${from}&to=${to}`,
    usdMxnRate: "/api/v1/marketdata/fx/usdmxn",
    banxicoCetesCurve: "/api/v1/marketdata/banxico/cetes/curve",
  },
  brokerImport: {
    // Channel 1 — GBM monthly account statement (MXN). One file per month.
    // Multipart field `file`; returns a single async job.
    statements: "/api/v1/me/broker/gbm/statements",
    // Channel 2 — DriveWealth trade confirmations (USD). Multiple files, one
    // per trading day. Multipart field `files`; returns one job per file.
    drivewealthConfirmations: "/api/v1/me/broker/gbm/drivewealth-confirmations",
    // Auto-detects the broker from each uploaded PDF (1..N files). Returns 202
    // with one async job per file.
    upload: "/api/v1/me/broker/gbm/import",
    jobs: "/api/v1/me/broker/gbm/import-jobs",
    job: (jobId: string) => `/api/v1/me/broker/gbm/import-jobs/${encodeURIComponent(jobId)}`,
    retry: (jobId: string) => `/api/v1/me/broker/gbm/import-jobs/${encodeURIComponent(jobId)}/retry`,
  },
};
