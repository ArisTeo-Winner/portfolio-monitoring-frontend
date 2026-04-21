import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export function logout(refreshToken: string) {
  return apiRequest<string>(endpoints.auth.logout, {
    method: "POST",
    headers: {
      "X-Refresh-Token": refreshToken,
    },
  });
}
