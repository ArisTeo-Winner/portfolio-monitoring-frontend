import { env } from "@/lib/config/env";

export function startGoogleLogin() {
  window.location.assign(`${env.apiBaseUrl}/api/v1/oauth2/authorize/google`);
}
