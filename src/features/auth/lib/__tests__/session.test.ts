import { vi } from "vitest";
import { clearSession, expireSession, persistSession, readSession } from "../session";
import { useSessionStore } from "@/state/session.store";

const STORAGE_KEY = "cpm.accessToken";

beforeEach(() => {
  sessionStorage.clear();
  useSessionStore.setState({ accessToken: null });
  vi.restoreAllMocks();
});

describe("persistSession", () => {
  it("stores the access token in the session store", () => {
    persistSession("my-token");
    expect(useSessionStore.getState().accessToken).toBe("my-token");
  });

  it("does not persist the token to sessionStorage (memory-only security contract)", () => {
    persistSession("my-token");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("readSession", () => {
  it("returns null accessToken when no session exists", () => {
    expect(readSession()).toEqual({ accessToken: null });
  });

  it("returns the active access token after persistSession", () => {
    persistSession("active-token");
    expect(readSession()).toEqual({ accessToken: "active-token" });
  });
});

describe("clearSession", () => {
  it("removes the access token from the store", () => {
    persistSession("tok");
    clearSession();
    expect(readSession().accessToken).toBeNull();
  });

  it("removes the token from sessionStorage", () => {
    persistSession("tok");
    clearSession();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("expireSession", () => {
  it("clears the session state", () => {
    persistSession("tok");
    const replaceSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/portfolio", replace: replaceSpy },
      writable: true,
      configurable: true,
    });

    expireSession();

    expect(readSession().accessToken).toBeNull();
  });

  it("redirects to /login?session_expired=1 when not already on /login", () => {
    const replaceSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/portfolio", replace: replaceSpy },
      writable: true,
      configurable: true,
    });

    expireSession();

    expect(replaceSpy).toHaveBeenCalledWith("/login?session_expired=1");
  });

  it("does not redirect when already on /login", () => {
    const replaceSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/login", replace: replaceSpy },
      writable: true,
      configurable: true,
    });

    expireSession();

    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
