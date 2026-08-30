import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("renders its children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("is enabled by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button disabled onClick={handler}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("renders an icon when provided", () => {
    render(<Button icon={<svg data-testid="icon" />}>Save</Button>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders type=submit correctly", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
