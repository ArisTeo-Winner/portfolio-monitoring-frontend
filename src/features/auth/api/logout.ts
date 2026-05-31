import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { clearSession } from "@/features/auth/lib/session";

export async function logout(): Promise<void> {
  try {
    // auth: true — sends Authorization: Bearer <access-token> so the backend
    // can invalidate the session in Redis/DB.
    // credentials: "include" (set by apiRequest) sends the HttpOnly refresh-token
    // cookie so the backend can clear it via Set-Cookie: Max-Age=0.
    await apiRequest(endpoints.auth.logout, { method: "POST", auth: true });
  } finally {
    // Always clear local state, even if the backend call fails.
    clearSession();
  }
}
