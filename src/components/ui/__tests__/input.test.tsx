import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Input } from "../input";

describe("Input", () => {
  it("renders the label text", () => {
    render(<Input label="Email" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("hides the label visually (sr-only) when hideLabel is true", () => {
    render(<Input label="Email" hideLabel />);
    // Label remains in the DOM for screen readers but is visually hidden via sr-only.
    const label = screen.getByText("Email");
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass("sr-only");
  });

  it("renders the error message when provided", () => {
    render(<Input label="Email" error="Email is required" />);
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("does not render an error paragraph when no error is given", () => {
    render(<Input label="Email" />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("renders with the provided value", () => {
    render(<Input label="Email" value="test@example.com" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
  });

  it("calls onChange when the user types", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input label="Email" onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "hello");
    expect(onChange).toHaveBeenCalled();
  });

  it("passes the placeholder to the input element", () => {
    render(<Input label="Email" placeholder="Enter email" />);
    expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();
  });

  it("renders the data-testid on the wrapper div", () => {
    render(<Input label="Email" data-testid="email-input" />);
    expect(screen.getByTestId("email-input")).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    render(<Input label="Email" icon={<span data-testid="mail-icon">@</span>} />);
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
  });
});
