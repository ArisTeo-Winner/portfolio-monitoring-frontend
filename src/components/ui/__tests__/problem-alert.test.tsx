import { render, screen } from "@testing-library/react";
import { ProblemAlert } from "../problem-alert";

describe("ProblemAlert", () => {
  it("renders nothing when message is undefined", () => {
    const { container } = render(<ProblemAlert />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when message is null", () => {
    const { container } = render(<ProblemAlert message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when message is an empty string", () => {
    const { container } = render(<ProblemAlert message="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the message text when provided", () => {
    render(<ProblemAlert message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("applies a custom className when provided", () => {
    const { container } = render(
      <ProblemAlert message="Error" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("uses the default styling when no className is provided", () => {
    const { container } = render(<ProblemAlert message="Error" />);
    expect(container.firstChild).toHaveClass("text-red-400");
  });
});
