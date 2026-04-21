import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { UserResponse } from "../types/user.types";

export function getMe() {
  return apiRequest<UserResponse>(endpoints.users.me, {
    method: "GET",
    auth: true,
  });
}
