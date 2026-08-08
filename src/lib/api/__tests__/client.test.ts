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
    formData.append("docType", "DRIVEWEALTH_CONFIRMATION");

    await apiUpload("/api/v1/me/import/preview", formData, { method: "POST" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${env.apiBaseUrl}/api/v1/me/import/preview`);
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

    await apiRequest("/api/v1/me/import/confirm", {
      method: "POST",
      body: { previewId: "abc", rowIds: ["1", "2"] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ previewId: "abc", rowIds: ["1", "2"] }));
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
