import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { RegisterPayload, UserResponse } from "@/features/auth/types/auth.types";

export function registerUser(payload: RegisterPayload) {
  return apiRequest<UserResponse>(endpoints.auth.register, {
    method: "POST",
    body: payload,
  });
}
