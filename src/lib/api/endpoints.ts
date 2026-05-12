export const endpoints = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/users/register",
    logout: "/api/v1/auth/logout",
    refresh: "/api/v1/tokens/refresh",
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
    bySymbol: (symbol: string) => `/api/v1/me/portfolio/${symbol}`,
    holdingsPerformance: (portfolioId: string) =>
      `/api/v1/me/portfolio/${encodeURIComponent(portfolioId)}/holdings-performance`,
    history: "/api/v1/me/portfolio/history",
    assetHistory: (symbol: string) =>
      `/api/v1/me/portfolio/assets/${encodeURIComponent(symbol)}/history`,
    assetMarkers: (symbol: string) =>
      `/api/v1/me/portfolio/assets/${encodeURIComponent(symbol)}/markers`,
  },
  transactions: {
    me: "/api/v1/me/transactions",
    byId: (transactionId: string) => `/api/v1/me/transactions/${transactionId}`,
    details: (transactionId: string) => `/api/v1/me/transactions/details/${transactionId}`,
    buy: "/api/v1/me/transactions/buy",
    sell: "/api/v1/me/transactions/sell",
    transfer: "/api/v1/me/transactions/transfer",
  },
  assets: {
    search: "/api/v1/assets/search",
  },
  marketdata: {
    cryptoPrice: (symbol: string) => `/api/v1/crypto/${symbol}/price`,
    stockPrice: (symbol: string) => `/api/v1/marketdata/stock?symbol=${encodeURIComponent(symbol)}`,
  },
};
