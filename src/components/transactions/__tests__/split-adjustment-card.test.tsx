import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SplitAdjustmentCard, SplitPreviewNotice } from "@/components/transactions/split-adjustment-card";
import type { SplitPreviewResponse } from "@/features/portfolio/types/split-preview.types";

const FORWARD: SplitPreviewResponse = {
  splitDetected: true,
  splitType: "FORWARD",
  factor: 10,
  splits: [{ ratio: "10-for-1", executionDate: "2024-06-07", shareMultiplier: 10 }],
  original: { quantity: 10, pricePerUnit: 900 },
  adjusted: { quantity: 100, pricePerUnit: 90 },
  note: "backend fallback copy",
};

const REVERSE: SplitPreviewResponse = {
  splitDetected: true,
  splitType: "REVERSE",
  factor: 0.01,
  splits: [{ ratio: "1-for-100", executionDate: "2026-08-03", shareMultiplier: 0.01 }],
  original: { quantity: 377.13248, pricePerUnit: 0.10993 },
  adjusted: { quantity: 3.7713248, pricePerUnit: 10.993 },
  note: "backend fallback copy",
};

const NO_SPLIT: SplitPreviewResponse = {
  splitDetected: false,
  splitType: null,
  factor: 1,
  splits: [],
  original: { quantity: 10, pricePerUnit: 900 },
  adjusted: { quantity: 10, pricePerUnit: 900 },
  note: null,
};

const DETECTION_ONLY: SplitPreviewResponse = {
  splitDetected: true,
  splitType: "FORWARD",
  factor: 10,
  splits: [{ ratio: "10-for-1", executionDate: "2024-06-07", shareMultiplier: 10 }],
  original: { quantity: null, pricePerUnit: null },
  adjusted: { quantity: null, pricePerUnit: null },
  note: null,
};

describe("SplitAdjustmentCard (detail block)", () => {
  it("renders captured vs post-split rows, the ratio badge and the value-unchanged reassurance", () => {
    render(<SplitAdjustmentCard preview={FORWARD} currency="USD" />);

    expect(screen.getByTestId("split-adjustment-card")).toBeInTheDocument();
    expect(screen.getByTestId("split-original")).toHaveTextContent("10");
    expect(screen.getByTestId("split-adjusted")).toHaveTextContent("100");
    expect(screen.getByTestId("split-ratio-badge")).toHaveTextContent("10-for-1, 07/06/2024");
    expect(screen.getByText(/no cambió de valor/i)).toBeInTheDocument();
  });

  it("renders nothing when no split was detected", () => {
    const { container } = render(<SplitAdjustmentCard preview={NO_SPLIT} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on detection-only responses (no amounts)", () => {
    const { container } = render(<SplitAdjustmentCard preview={DETECTION_ONLY} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SplitPreviewNotice (modal step 3)", () => {
  it("shows the value-unchanged line and tags the split type (FORWARD → price drops)", () => {
    render(<SplitPreviewNotice preview={FORWARD} currency="USD" />);

    const notice = screen.getByTestId("split-preview-notice");
    expect(notice).toHaveAttribute("data-split-type", "FORWARD");
    expect(notice).toHaveTextContent("baja de");
    expect(screen.getByText(/no cambió de valor/i)).toBeInTheDocument();
  });

  it("flags a reverse split (price rises) so retail users are reassured", () => {
    render(<SplitPreviewNotice preview={REVERSE} currency="USD" />);

    const notice = screen.getByTestId("split-preview-notice");
    expect(notice).toHaveAttribute("data-split-type", "REVERSE");
    expect(notice).toHaveTextContent("sube de");
    // Reverse shrinks share count (377 → 3.77) — the reassurance is critical here.
    expect(screen.getByText(/no cambió de valor/i)).toBeInTheDocument();
    expect(notice).toHaveTextContent("3.7713248");
  });

  it("renders nothing when no split was detected", () => {
    const { container } = render(<SplitPreviewNotice preview={NO_SPLIT} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
  });
});
