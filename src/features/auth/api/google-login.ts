import { env, ensureClientRuntimeConfig } from "@/lib/config/env";

export function startGoogleLogin() {
  ensureClientRuntimeConfig();
  window.location.assign(`${env.apiBaseUrl}/api/v1/oauth2/authorize/google`);
}
