import { clearSession } from "@/features/auth/lib/session";

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    });
  } finally {
    // Always clear local state, even if the BFF call fails.
    clearSession();
  }
}
