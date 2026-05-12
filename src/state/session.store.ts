import { create } from "zustand";

const CHANNEL_NAME = "cpm.auth.sync";
const ACCESS_TOKEN_STORAGE_KEY = "cpm.accessToken";

type SessionStore = {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  accessToken: readStoredAccessToken(),
  setAccessToken: (token: string) => {
    writeStoredAccessToken(token);
    set({ accessToken: token });
  },
  clearSession: () => {
    clearStoredAccessToken();
    set({ accessToken: null });
    broadcastLogout();
  },
}));

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

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken ?? readStoredAccessToken();
}

export function setAccessToken(token: string): void {
  writeStoredAccessToken(token);
  useSessionStore.setState({ accessToken: token });
}

export function clearSessionStore(): void {
  useSessionStore.getState().clearSession();
}

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } catch {
    // Keep the in-memory session usable if storage is unavailable.
  }
}

function clearStoredAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
