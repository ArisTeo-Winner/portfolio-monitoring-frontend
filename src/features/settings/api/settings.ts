import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/problem-details";
import { readSession } from "@/features/auth/lib/session";
import type {
  AccountSettings,
  ChangePasswordInput,
  PreferencesSettings,
  SessionSettings,
  UpdateAccountSettingsInput,
} from "@/features/settings/types/settings.types";

type RawSession = Partial<SessionSettings> & {
  ip?: string;
  isCurrent?: boolean;
  userAgent?: string;
};

const defaultPreferences: PreferencesSettings = {
  pnlMethod: "FIFO",
  defaultCurrency: "USD",
  chartDefaultTimeframe: "30D",
  dataProviderPriority: "FIRST_AVAILABLE",
  autoSyncFrequency: "1H",
  autoSyncEnabled: true,
};

const preferencesStorageKey = "cpm.settings.preferences";

export async function getAccountSettings() {
  return apiRequest<AccountSettings>(endpoints.settings.account, { auth: true });
}

export async function updateAccountSettings(payload: UpdateAccountSettingsInput) {
  return apiRequest<AccountSettings>(endpoints.settings.account, {
    auth: true,
    method: "PUT",
    body: payload,
  });
}

export async function changePassword(payload: ChangePasswordInput) {
  return apiRequest<void>(endpoints.settings.changePassword, {
    auth: true,
    method: "POST",
    body: payload,
  });
}

export async function getSessions(): Promise<SessionSettings[]> {
  try {
    const response = await apiRequest<RawSession[] | { sessions?: RawSession[] }>(
      endpoints.settings.sessions,
      {
        auth: true,
      },
    );

    return normalizeSessionsResponse(response);
  } catch (error) {
    if (shouldFallbackToDerivedSession(error)) {
      return deriveCurrentSession();
    }

    throw error;
  }
}

export async function revokeSession(sessionId: string) {
  return apiRequest<void>(endpoints.settings.session(sessionId), {
    auth: true,
    method: "DELETE",
  });
}

export async function getPreferences() {
  return { ...defaultPreferences, ...readStoredPreferences() };
}

export async function updatePreferences(payload: PreferencesSettings) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify(payload));
  }

  return payload;
}

function readStoredPreferences() {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(preferencesStorageKey);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Partial<PreferencesSettings>;
  } catch {
    window.localStorage.removeItem(preferencesStorageKey);
    return {};
  }
}

function normalizeSession(session: RawSession): SessionSettings {
  return {
    id: String(session.id ?? ""),
    device: session.device ?? session.userAgent ?? "Unknown device",
    ipAddress: session.ipAddress ?? session.ip ?? "Masked",
    createdAt: session.createdAt ?? "",
    lastActiveAt: session.lastActiveAt ?? session.createdAt ?? "",
    current: Boolean(session.current ?? session.isCurrent),
    location: session.location ?? null,
  };
}

function normalizeSessionsResponse(response: RawSession[] | { sessions?: RawSession[] }) {
  const sessions = Array.isArray(response) ? response : response.sessions ?? [];
  return sessions
    .map(normalizeSession)
    .filter((session) => session.id)
    .sort(compareSessionsByLastActiveDesc);
}

function compareSessionsByLastActiveDesc(left: SessionSettings, right: SessionSettings) {
  const lastActiveDiff = parseSortableDate(right.lastActiveAt) - parseSortableDate(left.lastActiveAt);
  if (lastActiveDiff !== 0) {
    return lastActiveDiff;
  }

  const createdDiff = parseSortableDate(right.createdAt) - parseSortableDate(left.createdAt);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  if (left.current !== right.current) {
    return left.current ? -1 : 1;
  }

  return left.device.localeCompare(right.device);
}

function parseSortableDate(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldFallbackToDerivedSession(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 501);
}

function deriveCurrentSession(): SessionSettings[] {
  if (typeof window === "undefined") return [];

  const stored = readSession();
  if (!stored?.accessToken) return [];

  const payload = decodeJwtPayload(stored.accessToken);
  if (!payload) return [];

  const sessionId = String(payload.session_id ?? payload.jti ?? payload.sub ?? "current");
  const issuedAt =
    typeof payload.iat === "number" ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString();

  return [
    {
      id: sessionId,
      device: parseUserAgent(navigator.userAgent),
      ipAddress: "—",
      createdAt: issuedAt,
      lastActiveAt: new Date().toISOString(),
      current: true,
      location: null,
    },
  ];
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadB64] = token.split(".");
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseUserAgent(ua: string): string {
  if (/mobile/i.test(ua)) {
    if (/android/i.test(ua)) return "Android Mobile";
    if (/iphone/i.test(ua)) return "iPhone";
    return "Mobile Device";
  }
  if (/tablet|ipad/i.test(ua)) return "Tablet";
  if (/windows nt/i.test(ua)) return "Windows Desktop";
  if (/macintosh|mac os x/i.test(ua)) return "macOS Desktop";
  if (/linux/i.test(ua)) return "Linux Desktop";
  return "Desktop Browser";
}
