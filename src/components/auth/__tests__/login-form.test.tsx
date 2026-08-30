import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LoginForm } from "../login-form";

// ── Mocks ────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/features/auth/api/login", () => ({
  login: vi.fn(),
}));

vi.mock("@/features/auth/lib/session", () => ({
  persistSession: vi.fn(),
}));

import { login } from "@/features/auth/api/login";
import { persistSession } from "@/features/auth/lib/session";

const mockedLogin = vi.mocked(login);
const mockedPersistSession = vi.mocked(persistSession);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Both inputs use hideLabel=true so the label text is not rendered.
// The data-testid is on the wrapper <div>, not the <input> itself.
function getEmailInput() {
  return screen.getByTestId("email-input").querySelector("input") as HTMLInputElement;
}

function getPasswordInput() {
  return screen.getByTestId("password-input").querySelector("input") as HTMLInputElement;
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(getEmailInput(), email);
  await user.type(getPasswordInput(), password);
  await user.click(screen.getByTestId("submit-login"));
  return user;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  pushMock.mockReset();
  refreshMock.mockReset();
});

describe("LoginForm – initial render", () => {
  it("renders the email input", () => {
    render(<LoginForm />);
    expect(getEmailInput()).toBeInTheDocument();
  });

  it("renders the password input", () => {
    render(<LoginForm />);
    expect(getPasswordInput()).toBeInTheDocument();
  });

  it("renders the Acceder submit button", () => {
    render(<LoginForm />);
    expect(screen.getByTestId("submit-login")).toBeInTheDocument();
  });

  it("submit button is disabled when both fields are empty", () => {
    render(<LoginForm />);
    expect(screen.getByTestId("submit-login")).toBeDisabled();
  });

  it("pre-fills the email field from the initialEmail prop", () => {
    render(<LoginForm initialEmail="user@example.com" />);
    expect(getEmailInput()).toHaveValue("user@example.com");
  });
});

describe("LoginForm – field interaction", () => {
  it("enables the submit button once both fields are filled", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(getEmailInput(), "user@example.com");
    await user.type(getPasswordInput(), "secret");
    expect(screen.getByTestId("submit-login")).toBeEnabled();
  });

  it("keeps submit disabled when only the email is filled", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(getEmailInput(), "user@example.com");
    expect(screen.getByTestId("submit-login")).toBeDisabled();
  });

  it("toggles password visibility with the show/hide button", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    expect(getPasswordInput()).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /mostrar/i }));
    expect(getPasswordInput()).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /ocultar/i }));
    expect(getPasswordInput()).toHaveAttribute("type", "password");
  });
});

describe("LoginForm – client-side validation", () => {
  it("shows a Zod error for an invalid email without calling login()", async () => {
    render(<LoginForm />);
    await fillAndSubmit("not-an-email", "Password1!");

    await waitFor(() => {
      expect(screen.getByText(/correo inv/i)).toBeInTheDocument();
    });
    expect(mockedLogin).not.toHaveBeenCalled();
  });
});

describe("LoginForm – successful login", () => {
  it("calls login() with the trimmed email and password", async () => {
    mockedLogin.mockResolvedValue("access-token");
    render(<LoginForm />);
    await fillAndSubmit("user@example.com", "Password1!");

    await waitFor(() =>
      expect(mockedLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "Password1!",
      }),
    );
  });

  it("calls persistSession with the returned access token", async () => {
    mockedLogin.mockResolvedValue("access-token");
    render(<LoginForm />);
    await fillAndSubmit("user@example.com", "Password1!");

    await waitFor(() =>
      expect(mockedPersistSession).toHaveBeenCalledWith("access-token"),
    );
  });

  it("navigates to /portfolio after a successful login", async () => {
    mockedLogin.mockResolvedValue("access-token");
    render(<LoginForm />);
    await fillAndSubmit("user@example.com", "Password1!");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/portfolio"));
  });
});

describe("LoginForm – failed login", () => {
  it("shows a controlled error message when login() rejects", async () => {
    mockedLogin.mockRejectedValue(new Error("server error"));
    render(<LoginForm />);
    await fillAndSubmit("user@example.com", "WrongPass1!");

    await waitFor(() => {
      expect(screen.getByText(/no fue posible iniciar sesión/i)).toBeInTheDocument();
    });
  });

  it("does not navigate after a failed login", async () => {
    mockedLogin.mockRejectedValue(new Error("fail"));
    render(<LoginForm />);
    await fillAndSubmit("user@example.com", "WrongPass1!");

    await waitFor(() => expect(mockedLogin).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
