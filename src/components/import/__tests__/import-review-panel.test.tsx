import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportReviewPanel } from "@/components/import/import-review-panel";
import { getUserTransactions } from "@/features/transactions/api/get-transactions";
import { deleteTransaction } from "@/features/transactions/api/create-transaction";
import type { ImportJob } from "@/features/import/types/import.types";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";

vi.mock("@/features/transactions/api/get-transactions", () => ({ getUserTransactions: vi.fn() }));
vi.mock("@/features/transactions/api/create-transaction", () => ({ deleteTransaction: vi.fn() }));

const mockedGet = vi.mocked(getUserTransactions);
const mockedDelete = vi.mocked(deleteTransaction);

const JOB: ImportJob = {
  jobId: "j1",
  fileName: "dw.pdf",
  jobType: "DRIVEWEALTH_CONFIRMATION",
  status: "COMPLETED",
  result: { fileName: "dw.pdf", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
  errorMessage: null,
  attemptCount: 0,
  createdAt: "2026-08-22T10:00:00Z",
  completedAt: "2026-08-22T10:00:30Z",
};

function tx(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    transactionId: "t1",
    assetSymbol: "AAPL",
    assetType: "STOCK",
    transactionType: "BUY",
    quantity: 1.5,
    pricePerUnit: 200,
    totalValue: 300,
    transactionDate: "2026-08-19T00:00:00Z",
    fee: 0,
    createdAt: "2026-08-22T10:00:10Z",
    updatedAt: "2026-08-22T10:00:10Z",
    broker: "DriveWealth",
    currency: "USD",
    ...overrides,
  };
}

describe("ImportReviewPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and lists the transactions attributed to the job", async () => {
    mockedGet.mockResolvedValue([tx({ transactionId: "a" }), tx({ transactionId: "b", assetSymbol: "MSFT" })]);
    render(<ImportReviewPanel job={JOB} />);

    await waitFor(() => expect(screen.getAllByTestId("import-review-row")).toHaveLength(2));
    expect(screen.getByTestId("import-review-count")).toHaveTextContent("2 en esta carga");
  });

  it("shows the empty state when nothing matches", async () => {
    mockedGet.mockResolvedValue([tx({ broker: "IBKR" })]);
    render(<ImportReviewPanel job={JOB} />);
    await screen.findByTestId("import-review-empty");
  });

  it("confirms before deleting, then removes the row and notifies", async () => {
    mockedGet.mockResolvedValue([tx({ transactionId: "a" })]);
    mockedDelete.mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(<ImportReviewPanel job={JOB} onChanged={onChanged} />);

    await screen.findByTestId("import-review-row");

    // First click reveals the confirm affordance, no delete yet.
    await userEvent.click(screen.getByTestId("import-review-delete"));
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId("import-review-confirm")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("import-review-confirm-yes"));

    await waitFor(() => expect(screen.queryByTestId("import-review-row")).not.toBeInTheDocument());
    expect(mockedDelete).toHaveBeenCalledWith("a");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("surfaces a delete error and keeps the row", async () => {
    mockedGet.mockResolvedValue([tx({ transactionId: "a" })]);
    mockedDelete.mockRejectedValue(new Error("boom"));
    render(<ImportReviewPanel job={JOB} />);

    await screen.findByTestId("import-review-row");
    await userEvent.click(screen.getByTestId("import-review-delete"));
    await userEvent.click(screen.getByTestId("import-review-confirm-yes"));

    await screen.findByTestId("import-review-delete-error");
    expect(screen.getByTestId("import-review-row")).toBeInTheDocument();
  });
});
