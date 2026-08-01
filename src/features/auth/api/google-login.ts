import { env, ensureClientRuntimeConfig } from "@/lib/config/env";
import { createOAuthState } from "@/features/auth/lib/oauth-state";

export function startGoogleLogin() {
  ensureClientRuntimeConfig();
  // Bind this OAuth2 flow to the initiating browser: store a random nonce in
  // sessionStorage and forward it as the `state` param so the callback can
  // prove the sign-in was started from this tab (anti login-CSRF / fixation).
  const state = createOAuthState();
  const authorizeUrl = new URL(`${env.apiBaseUrl}/api/v1/oauth2/authorize/google`);
  authorizeUrl.searchParams.set("state", state);
  window.location.assign(authorizeUrl.toString());
}
