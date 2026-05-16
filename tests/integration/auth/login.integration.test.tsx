import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { LoginForm } from "@/components/auth/login-form";
import { authFixtures } from "../../mocks/fixtures/auth";
import { useSessionStore } from "@/state/session.store";

// ── Router mock (Next.js navigation) ─────────────────────────────────────────
const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
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
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  sessionStorage.clear();
  useSessionStore.setState({ accessToken: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LoginForm – successful login (MSW)", () => {
  it("navigates to /portfolio after a successful login", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, authFixtures.validPassword);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/portfolio");
    });
  });

  it("stores the access token in sessionStorage after a successful login", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, authFixtures.validPassword);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(sessionStorage.getItem("cpm.accessToken")).toBe(authFixtures.accessToken);
  });

  it("updates the Zustand session store with the access token", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, authFixtures.validPassword);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(useSessionStore.getState().accessToken).toBe(authFixtures.accessToken);
  });

  it("does not expose the access token anywhere in the rendered DOM", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, authFixtures.validPassword);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(document.body.innerHTML).not.toContain(authFixtures.accessToken);
  });
});

describe("LoginForm – invalid credentials (MSW)", () => {
  it("displays the error message returned by the server on 401", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, "WrongPassword1!");

    await waitFor(() => {
      expect(screen.getByText("Credenciales invalidas.")).toBeInTheDocument();
    });
  });

  it("does not navigate on invalid credentials", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, "WrongPassword1!");

    await waitFor(() => {
      expect(screen.getByText("Credenciales invalidas.")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not store any token in sessionStorage on 401", async () => {
    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, "WrongPassword1!");

    await waitFor(() => {
      expect(screen.getByText("Credenciales invalidas.")).toBeInTheDocument();
    });
    expect(sessionStorage.getItem("cpm.accessToken")).toBeNull();
  });
});

describe("LoginForm – server error (MSW)", () => {
  it("displays a controlled error message on 500", async () => {
    server.use(
      http.post("http://localhost/api/auth/login", () =>
        HttpResponse.json(
          { detail: "Servicio no disponible. Intente mas tarde." },
          { status: 500 },
        ),
      ),
    );

    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, authFixtures.validPassword);

    await waitFor(() => {
      expect(
        screen.getByText("Servicio no disponible. Intente mas tarde."),
      ).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("displays the HTTP status text when the server response body is empty", async () => {
    server.use(
      http.post("http://localhost/api/auth/login", () =>
        HttpResponse.json({}, { status: 502 }),
      ),
    );

    render(<LoginForm />);
    await fillAndSubmit(authFixtures.validEmail, authFixtures.validPassword);

    // No detail/title in body → login() uses response.statusText ("Bad Gateway")
    await waitFor(() => {
      expect(screen.getByText("Bad Gateway")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
