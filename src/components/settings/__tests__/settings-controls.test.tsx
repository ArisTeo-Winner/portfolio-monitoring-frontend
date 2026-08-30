import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SettingsSelect, SettingsToggle } from "../settings-controls";

const OPTIONS = [
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "MXN", value: "MXN" },
];

describe("SettingsSelect", () => {
  it("renders the label", () => {
    render(<SettingsSelect label="Currency" options={OPTIONS} />);
    expect(screen.getByText("Currency")).toBeInTheDocument();
  });

  it("hides the label visually (sr-only) when hideLabel is true", () => {
    render(<SettingsSelect label="Currency" options={OPTIONS} hideLabel />);
    // Label remains in the DOM for screen readers but is visually hidden via sr-only.
    const label = screen.getByText("Currency");
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass("sr-only");
  });

  it("renders all options", () => {
    render(<SettingsSelect label="Currency" options={OPTIONS} />);
    expect(screen.getByRole("option", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "EUR" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "MXN" })).toBeInTheDocument();
  });

  it("selects the option matching the value prop", () => {
    render(<SettingsSelect label="Currency" options={OPTIONS} value="EUR" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("EUR");
  });

  it("renders the error message when provided", () => {
    render(<SettingsSelect label="Currency" options={OPTIONS} error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("calls onChange when the user picks a different option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsSelect label="Currency" options={OPTIONS} onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "EUR");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("SettingsToggle", () => {
  it("renders the label text", () => {
    render(<SettingsToggle label="Auto-sync" />);
    expect(screen.getByText("Auto-sync")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<SettingsToggle label="Auto-sync" description="Sync every hour" />);
    expect(screen.getByText("Sync every hour")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<SettingsToggle label="Auto-sync" />);
    expect(screen.queryByText("Sync every hour")).not.toBeInTheDocument();
  });

  it("reflects the checked state on the hidden input", () => {
    render(<SettingsToggle label="Auto-sync" checked onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("reflects unchecked state", () => {
    render(<SettingsToggle label="Auto-sync" checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls onChange when toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsToggle label="Auto-sync" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalled();
  });
});
