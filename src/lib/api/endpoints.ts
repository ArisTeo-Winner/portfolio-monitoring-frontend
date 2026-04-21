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
  portfolio: {
    me: "/api/v1/me/portfolio",
    bySymbol: (symbol: string) => `/api/v1/me/portfolio/${symbol}`,
    holdingsPerformance: (portfolioId: string) =>
      `/api/v1/me/portfolio/${encodeURIComponent(portfolioId)}/holdings-performance`,
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
