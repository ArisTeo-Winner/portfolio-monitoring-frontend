/**
 * OAuth2 state/nonce binding.
 *
 * Security contract:
 *  - Before redirecting the browser to the OAuth2 authorization endpoint,
 *    startGoogleLogin() generates a random nonce, stores it in sessionStorage
 *    (scoped to this tab/origin) and forwards it as the OAuth `state` param.
 *  - The callback (same tab) reads + consumes that nonce and refuses to persist
 *    any tokens unless a nonce was actually stored by this browser. This binds
 *    the flow to the initiating browser and prevents login CSRF / session
 *    fixation via a crafted `/auth/callback#accessToken=...&refreshToken=...`
 *    link opened without a prior startGoogleLogin() in that tab.
 *  - The nonce is one-time use: it is removed unconditionally on the first
 *    verification, so a captured link cannot be replayed.
 */

const OAUTH_STATE_STORAGE_KEY = "cpm.oauth.state";

/**
 * Generate a cryptographically-random nonce, persist it in sessionStorage, and
 * return it so the caller can forward it as the OAuth2 `state` query parameter.
 */
export function createOAuthState(): string {
  const state = generateNonce();
  try {
    window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
  } catch {
    // sessionStorage may be unavailable (private mode / disabled storage).
    // The callback will then find no stored nonce and reject — fail closed.
  }
  return state;
}

/**
 * Read and unconditionally remove the stored nonce (one-time use / anti-replay).
 *
 * Returns true only if a nonce was stored AND, when the backend echoes a state
 * value (returnedState is non-null), it matches the stored nonce. A null
 * returnedState is accepted so the flow still works when the backend ignores
 * the state parameter — the presence of a stored nonce is what proves the flow
 * was initiated by this browser.
 */
export function verifyAndConsumeOAuthState(returnedState: string | null): boolean {
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
  } catch {
    return false;
  }

  if (!stored) {
    return false;
  }

  if (returnedState !== null && returnedState !== stored) {
    return false;
  }

  return true;
}

function generateNonce(): string {
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  throw new Error("Secure random generator unavailable for OAuth state.");
}
