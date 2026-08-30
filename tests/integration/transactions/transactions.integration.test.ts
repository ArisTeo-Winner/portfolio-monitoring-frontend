import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { getUserTransactions } from "@/features/transactions/api/get-transactions";
import { transactionFixtures } from "../../mocks/fixtures/transactions";
import { useSessionStore } from "@/state/session.store";
import { ApiError } from "@/lib/api/problem-details";

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  sessionStorage.setItem("cpm.accessToken", "test-token");
  useSessionStore.setState({ accessToken: "test-token" });
});

afterEach(() => {
  sessionStorage.removeItem("cpm.accessToken");
  useSessionStore.setState({ accessToken: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getUserTransactions – happy path (MSW)", () => {
  it("returns the full transaction list", async () => {
    const result = await getUserTransactions();
    expect(result).toHaveLength(transactionFixtures.list.length);
    expect(result[0].transactionId).toBe("tx-1");
    expect(result[0].assetSymbol).toBe("BTC");
    expect(result[1].transactionId).toBe("tx-2");
    expect(result[1].assetSymbol).toBe("ETH");
  });

  it("returns transaction objects with the expected shape", async () => {
    const [first] = await getUserTransactions();
    expect(first).toMatchObject({
      transactionId: expect.any(String),
      assetSymbol: expect.any(String),
      assetType: expect.any(String),
      transactionType: expect.any(String),
      quantity: expect.any(Number),
      pricePerUnit: expect.any(Number),
    });
  });

  it("returns an empty array when there are no transactions", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", () => HttpResponse.json([])),
    );
    const result = await getUserTransactions();
    expect(result).toEqual([]);
  });
});

describe("getUserTransactions – id normalization (MSW)", () => {
  it("normalizes transaction_id (snake_case) to transactionId when the top-level field is absent", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", () =>
        HttpResponse.json([transactionFixtures.rawWithLegacyId]),
      ),
    );
    const result = await getUserTransactions();
    expect(result[0].transactionId).toBe("tx-legacy");
  });

  it("normalizes STOCKS assetType to STOCK", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", () =>
        HttpResponse.json([
          {
            ...transactionFixtures.list[0],
            assetSymbol: "AAPL",
            assetType: "STOCKS",
          },
        ]),
      ),
    );
    const result = await getUserTransactions();
    expect(result[0].assetType).toBe("STOCK");
  });
});

describe("getUserTransactions – filtering (MSW)", () => {
  it("passes assetSymbol as a query param and returns filtered results", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(
          transactionFixtures.list.filter((t) => t.assetSymbol === "BTC"),
        );
      }),
    );

    const result = await getUserTransactions({ assetSymbol: "BTC" });
    expect(capturedUrl!.searchParams.get("assetSymbol")).toBe("BTC");
    expect(result.every((t) => t.assetSymbol === "BTC")).toBe(true);
  });

  it("applies client-side assetType filter after fetching", async () => {
    const result = await getUserTransactions({ assetType: "CRYPTO" });
    expect(result.every((t) => t.assetType === "CRYPTO")).toBe(true);
  });
});

describe("getUserTransactions – error handling (MSW)", () => {
  it("throws ApiError on a 500 server error", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 }),
      ),
    );
    await expect(getUserTransactions()).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError(403) with the controlled access-denied message", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(getUserTransactions()).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para realizar esta acción.",
    });
  });

  it("throws when the network is unavailable", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/transactions", () => HttpResponse.error()),
    );
    await expect(getUserTransactions()).rejects.toThrow();
  });
});
