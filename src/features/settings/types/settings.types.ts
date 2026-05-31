export type AccountSettings = {
  email: string;
  username: string;
  preferredCurrency?: "USD" | "EUR" | "MXN" | string;
  timezone?: string;
  passwordLastUpdatedAt?: string | null;
  twoFactorEnabled?: boolean | null;
};

export type UpdateAccountSettingsInput = {
  email: string;
  username: string;
  preferredCurrency: "USD" | "EUR" | "MXN" | string;
  timezone: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type SessionSettings = {
  id: string;
  device: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
  location?: string | null;
};

export type PreferencesSettings = {
  pnlMethod: "FIFO" | "AVERAGE_COST";
  defaultCurrency: "USD" | "EUR" | "MXN";
  chartDefaultTimeframe: "24H" | "7D" | "30D" | "90D" | "1Y" | "ALL";
  dataProviderPriority: "FIRST_AVAILABLE" | "COINGECKO" | "MANUAL";
  autoSyncFrequency: "MANUAL" | "15M" | "1H" | "6H" | "24H";
  autoSyncEnabled: boolean;
};
