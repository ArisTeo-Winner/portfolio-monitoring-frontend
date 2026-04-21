import type { JwtResponse } from "@/features/auth/types/auth.types";

const SESSION_KEY = "cpm.session";
const SESSION_EXPIRED_REDIRECT = "/login?session_expired=1";

export function persistSession(tokens: JwtResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
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

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as JwtResponse;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}
