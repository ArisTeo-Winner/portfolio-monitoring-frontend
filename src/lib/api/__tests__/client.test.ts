import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, apiUpload } from "../client";
import { env } from "@/lib/config/env";

function mockFetchOnce(body: unknown = {}, init: ResponseInit = { status: 200 }) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiUpload", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the FormData body as-is without forcing Content-Type", async () => {
    const fetchMock = mockFetchOnce({ ok: true });
    const formData = new FormData();
    formData.append("files", new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" }));

    await apiUpload("/api/v1/me/broker/gbm/import", formData, { method: "POST" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${env.apiBaseUrl}/api/v1/me/broker/gbm/import`);
    expect(init.body).toBe(formData);
    const headers = new Headers(init.headers);
    expect(headers.has("Content-Type")).toBe(false);
  });
});

describe("apiRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("still JSON-stringifies the body and forces Content-Type: application/json", async () => {
    const fetchMock = mockFetchOnce({ ok: true });

    await apiRequest("/api/v1/me/broker/gbm/import-jobs/j1/retry", {
      method: "POST",
      body: { reason: "manual" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ reason: "manual" }));
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
