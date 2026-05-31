/**
 * Session store — access token lives ONLY in memory (Zustand state).
 *
 * Security contract:
 *  - NEVER persist the access token to localStorage or sessionStorage.
 *  - The refresh token is an HttpOnly cookie managed exclusively by the
 *    browser / backend. JS cannot read or write it.
 *  - On page reload the access token is intentionally lost; the app
 *    bootstrap silently calls POST /api/v1/tokens/refresh to recover
 *    the session via the HttpOnly cookie.
 */

import { create } from "zustand";

const CHANNEL_NAME = "cpm.auth.sync";

type SessionStore = {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  // Always null on first load — session is recovered via silent refresh.
  accessToken: null,
  setAccessToken: (token: string) => {
    set({ accessToken: token });
  },
  clearSession: () => {
    set({ accessToken: null });
    broadcastLogout();
  },
}));

// ── Multi-tab logout sync via BroadcastChannel ────────────────────────────────

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  if (!_channel) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
    _channel.addEventListener("message", (event: MessageEvent<{ type: string }>) => {
      if (event.data?.type === "logout") {
        useSessionStore.setState({ accessToken: null });
        if (window.location.pathname !== "/login") {
          window.location.replace("/login?session_expired=1");
        }
      }
    });
  }
  return _channel;
}

function broadcastLogout(): void {
  getChannel()?.postMessage({ type: "logout" });
}

if (typeof window !== "undefined") {
  getChannel();
}

// ── Module-level helpers (used by lib/api/client and auth feature) ────────────

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}

export function setAccessToken(token: string): void {
  useSessionStore.setState({ accessToken: token });
}

export function clearSessionStore(): void {
  useSessionStore.getState().clearSession();
}
