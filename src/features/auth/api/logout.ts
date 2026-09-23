import { endpoints } from "@/lib/api/endpoints";
import { clearSession } from "@/features/auth/lib/session";

export async function logout(): Promise<void> {
  try {
    // Logout goes through the BFF (same-origin): it reads the HttpOnly `cpm.rt`
    // cookie, tells the backend to invalidate the session via X-Refresh-Token,
    // and clears `cpm.rt` via Set-Cookie: Max-Age=0.
    await fetch(endpoints.bff.logout, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } finally {
    // Always clear local state, even if the BFF/backend call fails.
    clearSession();
  }
}
