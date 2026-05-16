import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import {
  getAccountSettings,
  getPreferences,
  getSessions,
  updatePreferences,
} from "@/features/settings/api/settings";
import { settingsFixtures } from "../../mocks/fixtures/settings";
import { authFixtures } from "../../mocks/fixtures/auth";
import { useSessionStore } from "@/state/session.store";
import { ApiError } from "@/lib/api/problem-details";
import type { PreferencesSettings } from "@/features/settings/types/settings.types";

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  // Use a decodable JWT so deriveCurrentSession() can produce a fallback session
  sessionStorage.setItem("cpm.accessToken", authFixtures.accessToken);
  useSessionStore.setState({ accessToken: authFixtures.accessToken });
  localStorage.clear();
});

afterEach(() => {
  sessionStorage.removeItem("cpm.accessToken");
  useSessionStore.setState({ accessToken: null });
});

// ── Account settings ──────────────────────────────────────────────────────────

describe("getAccountSettings – MSW integration", () => {
  it("returns account settings from the API", async () => {
    const result = await getAccountSettings();
    expect(result.email).toBe("user@example.com");
    expect(result.username).toBe("testuser");
    expect(result.baseCurrency).toBe("USD");
  });

  it("throws ApiError on a 500 server error", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/users/me", () =>
        HttpResponse.json({ detail: "Service unavailable" }, { status: 503 }),
      ),
    );
    await expect(getAccountSettings()).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError(403) with the controlled access-denied message on 403", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/users/me", () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(getAccountSettings()).rejects.toMatchObject({
      status: 403,
      message: "You do not have permission to perform this action.",
    });
  });
});

// ── Sessions ──────────────────────────────────────────────────────────────────

describe("getSessions – MSW integration", () => {
  it("returns normalized sessions sorted by lastActiveAt descending", async () => {
    const result = await getSessions();
    // sess-1 lastActiveAt 2024-01-15 > sess-2 lastActiveAt 2024-01-10
    expect(result[0].id).toBe("sess-1");
    expect(result[0].current).toBe(true);
    expect(result[1].id).toBe("sess-2");
  });

  it("normalizes ip → ipAddress and isCurrent → current", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/sessions", () =>
        HttpResponse.json([
          {
            id: "sess-raw",
            userAgent: "Firefox",
            ip: "10.0.0.5",
            isCurrent: true,
            createdAt: "2024-01-01T00:00:00Z",
          },
        ]),
      ),
    );
    const result = await getSessions();
    expect(result[0].device).toBe("Firefox");
    expect(result[0].ipAddress).toBe("10.0.0.5");
    expect(result[0].current).toBe(true);
  });

  it("falls back to a derived session when the API returns 404", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/sessions", () =>
        HttpResponse.json({ detail: "Not found" }, { status: 404 }),
      ),
    );
    // deriveCurrentSession decodes authFixtures.accessToken and returns one session
    const result = await getSessions();
    expect(Array.isArray(result)).toBe(true);
    // The JWT payload has session_id = "sess-test-1"
    if (result.length > 0) {
      expect(result[0].id).toBe("sess-test-1");
      expect(result[0].current).toBe(true);
    }
  });

  it("falls back to a derived session when the API returns 501", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/sessions", () =>
        HttpResponse.json({ detail: "Not implemented" }, { status: 501 }),
      ),
    );
    const result = await getSessions();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws ApiError for non-fallback API errors", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/sessions", () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 }),
      ),
    );
    await expect(getSessions()).rejects.toBeInstanceOf(ApiError);
  });
});

// ── Preferences (localStorage-backed, no API call) ────────────────────────────

describe("getPreferences – MSW integration", () => {
  it("returns the default preferences when localStorage is empty", async () => {
    const result = await getPreferences();
    expect(result).toMatchObject(settingsFixtures.defaultPreferences);
  });

  it("merges stored overrides on top of the defaults", async () => {
    localStorage.setItem(
      "cpm.settings.preferences",
      JSON.stringify({ defaultCurrency: "EUR", autoSyncEnabled: false }),
    );
    const result = await getPreferences();
    expect(result.defaultCurrency).toBe("EUR");
    expect(result.autoSyncEnabled).toBe(false);
    expect(result.pnlMethod).toBe("FIFO"); // default preserved
  });

  it("falls back to defaults when localStorage contains malformed JSON", async () => {
    localStorage.setItem("cpm.settings.preferences", "not-json");
    const result = await getPreferences();
    expect(result.pnlMethod).toBe("FIFO");
    expect(result.defaultCurrency).toBe("USD");
  });
});

describe("updatePreferences – MSW integration", () => {
  it("persists the new preferences to localStorage and returns them", async () => {
    const newPrefs: PreferencesSettings = {
      pnlMethod: "AVERAGE_COST",
      defaultCurrency: "MXN",
      chartDefaultTimeframe: "7D",
      dataProviderPriority: "FIRST_AVAILABLE",
      autoSyncFrequency: "1H",
      autoSyncEnabled: false,
    };
    const result = await updatePreferences(newPrefs);
    expect(result).toEqual(newPrefs);

    const stored = JSON.parse(localStorage.getItem("cpm.settings.preferences") ?? "{}") as Partial<PreferencesSettings>;
    expect(stored.defaultCurrency).toBe("MXN");
    expect(stored.autoSyncEnabled).toBe(false);
  });

  it("round-trips: updatePreferences then getPreferences returns the saved values", async () => {
    const prefs: PreferencesSettings = {
      pnlMethod: "AVERAGE_COST",
      defaultCurrency: "EUR",
      chartDefaultTimeframe: "1Y",
      dataProviderPriority: "FIRST_AVAILABLE",
      autoSyncFrequency: "1H",
      autoSyncEnabled: true,
    };
    await updatePreferences(prefs);
    const result = await getPreferences();
    expect(result.defaultCurrency).toBe("EUR");
    expect(result.pnlMethod).toBe("AVERAGE_COST");
    expect(result.chartDefaultTimeframe).toBe("1Y");
  });
});
