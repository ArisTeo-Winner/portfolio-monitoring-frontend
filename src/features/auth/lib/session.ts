import { env } from "@/lib/config/env";
import type { JwtResponse } from "@/features/auth/types/auth.types";

const LEGACY_SESSION_KEY = "cpm.session";
const SESSION_EXPIRED_REDIRECT = "/login?session_expired=1";

export function persistSession(tokens: JwtResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getSessionKey(), JSON.stringify(tokens));
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getSessionKey());
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function expireSession() {
  if (typeof window === "undefined") {
    return;
  }

  clearSession();

  if (window.location.pathname !== "/login") {
    window.location.replace(SESSION_EXPIRED_REDIRECT);
  }
}

export function readSession(): JwtResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionKey = getSessionKey();
  const raw = window.localStorage.getItem(sessionKey) ?? migrateLegacySession(sessionKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as JwtResponse;
  } catch {
    window.localStorage.removeItem(sessionKey);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
    return null;
  }
}

function migrateLegacySession(sessionKey: string) {
  const legacy = window.localStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacy) {
    return null;
  }

  window.localStorage.setItem(sessionKey, legacy);
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
  return legacy;
}

function getSessionKey() {
  return `${LEGACY_SESSION_KEY}:${encodeStorageSegment(env.apiOrigin)}`;
}

function encodeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
