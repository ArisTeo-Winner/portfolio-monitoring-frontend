export const settingsFixtures = {
  account: {
    email: "user@example.com",
    username: "testuser",
    preferredCurrency: "USD",
    timezone: "UTC",
    passwordLastUpdatedAt: null,
    twoFactorEnabled: false,
  },

  // sess-1 is more recent (lastActiveAt 2024-01-15) so it should sort first
  sessions: [
    {
      id: "sess-1",
      device: "Chrome on Windows",
      ipAddress: "192.168.1.1",
      createdAt: "2024-01-01T00:00:00Z",
      lastActiveAt: "2024-01-15T00:00:00Z",
      current: true,
      location: null,
    },
    {
      id: "sess-2",
      device: "Firefox on macOS",
      ipAddress: "10.0.0.1",
      createdAt: "2024-01-05T00:00:00Z",
      lastActiveAt: "2024-01-10T00:00:00Z",
      current: false,
      location: "New York, US",
    },
  ],

  defaultPreferences: {
    pnlMethod: "FIFO",
    defaultCurrency: "USD",
    chartDefaultTimeframe: "30D",
    dataProviderPriority: "FIRST_AVAILABLE",
    autoSyncFrequency: "1H",
    autoSyncEnabled: true,
  },
};
