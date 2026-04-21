import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { JwtResponse, LoginPayload } from "@/features/auth/types/auth.types";

export function login(payload: LoginPayload) {
  return apiRequest<JwtResponse>(endpoints.auth.login, {
    method: "POST",
    body: payload,
  });
}
