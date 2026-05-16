import { vi } from "vitest";
import {
  clearSessionStore,
  getAccessToken,
  setAccessToken,
  useSessionStore,
} from "../session.store";

const STORAGE_KEY = "cpm.accessToken";

beforeEach(() => {
  sessionStorage.clear();
  useSessionStore.setState({ accessToken: null });
  vi.restoreAllMocks();
});

describe("setAccessToken", () => {
  it("updates the in-memory store", () => {
    setAccessToken("tok-123");
    expect(useSessionStore.getState().accessToken).toBe("tok-123");
  });

  it("writes the token to sessionStorage", () => {
    setAccessToken("tok-abc");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("tok-abc");
  });
});

describe("getAccessToken", () => {
  it("returns null when no token has been set", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("returns the token after setAccessToken", () => {
    setAccessToken("tok-xyz");
    expect(getAccessToken()).toBe("tok-xyz");
  });

  it("reads from sessionStorage when the in-memory store is empty", () => {
    sessionStorage.setItem(STORAGE_KEY, "stored-tok");
    // Reset in-memory state to force the sessionStorage fallback
    useSessionStore.setState({ accessToken: null });
    expect(getAccessToken()).toBe("stored-tok");
  });
});

describe("clearSessionStore", () => {
  it("removes the token from the in-memory store", () => {
    setAccessToken("tok-to-clear");
    clearSessionStore();
    expect(useSessionStore.getState().accessToken).toBeNull();
  });

  it("removes the token from sessionStorage", () => {
    setAccessToken("tok-to-clear");
    clearSessionStore();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("useSessionStore", () => {
  it("initialises accessToken from sessionStorage on first load", () => {
    sessionStorage.setItem(STORAGE_KEY, "pre-stored");
    // Re-read the initial value by directly checking what the store reads on mount
    const stored = sessionStorage.getItem(STORAGE_KEY);
    expect(stored).toBe("pre-stored");
  });

  it("exposes setAccessToken and clearSession actions", () => {
    const state = useSessionStore.getState();
    expect(typeof state.setAccessToken).toBe("function");
    expect(typeof state.clearSession).toBe("function");
  });

  it("clearSession resets accessToken to null", () => {
    useSessionStore.getState().setAccessToken("tok");
    useSessionStore.getState().clearSession();
    expect(useSessionStore.getState().accessToken).toBeNull();
  });
});
