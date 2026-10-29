import { getAccessToken, setAccessToken, clearSessionStore } from "@/state/session.store";

const SESSION_EXPIRED_REDIRECT = "/login?session_expired=1";

export function persistSession(accessToken: string): void {
  setAccessToken(accessToken);
}

export function clearSession(): void {
  clearSessionStore();
}

export function expireSession(): void {
  clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace(SESSION_EXPIRED_REDIRECT);
  }
}

export function readSession(): { accessToken: string | null } {
  return { accessToken: getAccessToken() };
}
