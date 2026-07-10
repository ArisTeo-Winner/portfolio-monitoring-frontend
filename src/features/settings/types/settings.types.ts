export type AccountSettings = {
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  preferredCurrency?: "USD" | "EUR" | "MXN" | string;
  timezone?: string;
  active?: boolean;
  createdAt?: string;
  passwordLastUpdatedAt?: string | null;
  twoFactorEnabled?: boolean | null;
};

export type UpdateAccountSettingsInput = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: string | null;
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
