import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FrictionBreakdownCard } from "@/components/transactions/friction-breakdown-card";
import type { FrictionBreakdown } from "@/features/transactions/types/transaction.types";

const BROKER_BREAKDOWN: FrictionBreakdown = {
  grossAmount: 1000,
  brokerCommission: 8.5,
  brokerIva: 1.36,
  otherFees: 0.25,
  totalFrictionCost: 10.11,
  finalNetCost: 1010.11,
  adjustedUnitPrice: 101.011,
  reviewStatus: "OK",
};

const MANUAL_BREAKDOWN: FrictionBreakdown = {
  grossAmount: 500,
  brokerCommission: null,
  brokerIva: null,
  otherFees: null,
  totalFrictionCost: 0,
  finalNetCost: 500,
  adjustedUnitPrice: 50,
  reviewStatus: null,
};

describe("FrictionBreakdownCard", () => {
  it("shows the four fine-grained fields when brokerCommission != null", () => {
    render(<FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />);

    expect(screen.getByTestId("friction-commission")).toBeInTheDocument();
    expect(screen.getByTestId("friction-iva")).toBeInTheDocument();
    expect(screen.getByTestId("friction-other-fees")).toBeInTheDocument();
  });

  it("hides the fine-grained fields on manual entries (brokerCommission == null) but keeps the derived ones", () => {
    render(<FrictionBreakdownCard breakdown={MANUAL_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />);

    expect(screen.queryByTestId("friction-commission")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friction-iva")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friction-other-fees")).not.toBeInTheDocument();

    // Derived fields are always rendered.
    expect(screen.getByTestId("friction-total")).toBeInTheDocument();
    expect(screen.getByTestId("friction-net")).toBeInTheDocument();
    expect(screen.getByTestId("friction-adjusted-unit-price")).toBeInTheDocument();
  });

  it("renders the review badge only when reviewStatus === REQUIERE_REVISION", () => {
    const { rerender } = render(
      <FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />,
    );
    expect(screen.queryByTestId("friction-review-badge")).not.toBeInTheDocument();

    rerender(
      <FrictionBreakdownCard
        breakdown={{ ...BROKER_BREAKDOWN, reviewStatus: "REQUIERE_REVISION" }}
        transactionType="BUY"
        feeCurrency="USD"
      />,
    );
    expect(screen.getByTestId("friction-review-badge")).toHaveTextContent("Requiere revisión");
  });

  it("does not render the badge when reviewStatus is null", () => {
    render(<FrictionBreakdownCard breakdown={MANUAL_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />);
    expect(screen.queryByTestId("friction-review-badge")).not.toBeInTheDocument();
  });

  it("omits the effective unit price row when adjustedUnitPrice is null (qty=0)", () => {
    render(
      <FrictionBreakdownCard
        breakdown={{ ...BROKER_BREAKDOWN, adjustedUnitPrice: null }}
        transactionType="BUY"
        feeCurrency="USD"
      />,
    );
    expect(screen.queryByTestId("friction-adjusted-unit-price")).not.toBeInTheDocument();
  });

  it("labels the net line as cost basis for BUY and as proceeds for SELL", () => {
    const { rerender } = render(
      <FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />,
    );
    expect(screen.getByTestId("friction-net")).toHaveTextContent("Costo base (neto real)");

    rerender(<FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="SELL" feeCurrency="USD" />);
    expect(screen.getByTestId("friction-net")).toHaveTextContent("Neto recibido real");
  });

  it("renders amounts in the transaction's fee currency (MXN)", () => {
    render(<FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="MXN" />);
    // es-MX MXN formatting uses the "$" symbol; assert the grouped integer part is present.
    expect(screen.getByTestId("friction-net")).toHaveTextContent("1,010.11");
  });

  it("labels the adjusted unit price as break-even for BUY and net for SELL", () => {
    const { rerender } = render(
      <FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />,
    );
    expect(screen.getByTestId("friction-adjusted-unit-price")).toHaveTextContent("Precio de equilibrio/u");

    rerender(<FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="SELL" feeCurrency="USD" />);
    expect(screen.getByTestId("friction-adjusted-unit-price")).toHaveTextContent("Precio neto/u");
  });

  it("shows the execution unit price row only when executionUnitPrice is provided", () => {
    const { rerender } = render(
      <FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="USD" />,
    );
    expect(screen.queryByTestId("friction-execution-unit-price")).not.toBeInTheDocument();

    rerender(
      <FrictionBreakdownCard
        breakdown={BROKER_BREAKDOWN}
        transactionType="BUY"
        feeCurrency="USD"
        executionUnitPrice={108.7988}
      />,
    );
    const executionRow = screen.getByTestId("friction-execution-unit-price");
    expect(executionRow).toHaveTextContent("Precio de ejecución/u");
    expect(executionRow).toHaveTextContent("108.80");
  });

  it("renders the per-unit friction bridge only when perUnitFriction and execution are both present", () => {
    // No perUnitFriction → no bridge, even with execution price.
    const { rerender } = render(
      <FrictionBreakdownCard
        breakdown={BROKER_BREAKDOWN}
        transactionType="BUY"
        feeCurrency="USD"
        executionUnitPrice={108.7988}
      />,
    );
    expect(screen.queryByTestId("friction-per-unit")).not.toBeInTheDocument();

    // With perUnitFriction + execution → bridge shows the value.
    rerender(
      <FrictionBreakdownCard
        breakdown={{ ...BROKER_BREAKDOWN, perUnitFriction: 0.26214052 }}
        transactionType="BUY"
        feeCurrency="USD"
        executionUnitPrice={108.7988}
      />,
    );
    const bridge = screen.getByTestId("friction-per-unit");
    expect(bridge).toHaveTextContent("fricción/u");
    expect(bridge).toHaveTextContent("0.26");
  });

  it("renders the CRCL golden ladder end-to-end: $108.80 + $0.26 = $109.06", () => {
    // Exact backend golden values (ADR-0004 / DriveWealth CRCL confirmation).
    const CRCL: FrictionBreakdown = {
      grossAmount: 103.759999,
      brokerCommission: 0.25,
      brokerIva: 0,
      otherFees: 0,
      totalFrictionCost: 0.25,
      finalNetCost: 104.009999,
      adjustedUnitPrice: 109.06094157,
      perUnitFriction: 0.26214052,
      reviewStatus: "OK",
    };
    render(
      <FrictionBreakdownCard
        breakdown={CRCL}
        transactionType="BUY"
        feeCurrency="USD"
        executionUnitPrice={108.79880105}
      />,
    );

    expect(screen.getByTestId("friction-execution-unit-price")).toHaveTextContent("$108.80");
    expect(screen.getByTestId("friction-per-unit")).toHaveTextContent("$0.26");
    expect(screen.getByTestId("friction-adjusted-unit-price")).toHaveTextContent("$109.06");
  });

  it("hides the bridge when perUnitFriction is set but there is no execution price to bridge from", () => {
    render(
      <FrictionBreakdownCard
        breakdown={{ ...BROKER_BREAKDOWN, perUnitFriction: 0.26214052 }}
        transactionType="BUY"
        feeCurrency="USD"
      />,
    );
    expect(screen.queryByTestId("friction-per-unit")).not.toBeInTheDocument();
  });

  it("omits the execution row but keeps the break-even price when adjustedUnitPrice is set and execution is null", () => {
    render(
      <FrictionBreakdownCard breakdown={BROKER_BREAKDOWN} transactionType="BUY" feeCurrency="USD" executionUnitPrice={null} />,
    );
    expect(screen.queryByTestId("friction-execution-unit-price")).not.toBeInTheDocument();
    expect(screen.getByTestId("friction-adjusted-unit-price")).toBeInTheDocument();
  });
});
