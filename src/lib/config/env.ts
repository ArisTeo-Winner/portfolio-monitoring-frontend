const DEFAULT_API_BASE_URL = "http://localhost:8080";
const DEFAULT_APP_URL = "http://localhost:3000";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || null;

const apiUrl = parseAbsoluteUrl(configuredApiBaseUrl, DEFAULT_API_BASE_URL);
const appUrl = configuredAppUrl ? parseAbsoluteUrl(configuredAppUrl, DEFAULT_APP_URL) : null;

export const env = {
  apiBaseUrl: trimTrailingSlash(apiUrl.toString()),
  apiOrigin: apiUrl.origin,
  appUrl: appUrl ? trimTrailingSlash(appUrl.toString()) : null,
  appOrigin: appUrl?.origin ?? null,
} as const;

let runtimeValidated = false;

export function ensureClientRuntimeConfig() {
  if (typeof window === "undefined" || runtimeValidated) {
    return;
  }

  const currentOrigin = window.location.origin;
  const currentUrl = new URL(currentOrigin);
  const currentIsLocal = isLocalLikeHost(currentUrl.hostname);
  const apiIsLocal = isLocalLikeHost(apiUrl.hostname);

  if (!currentIsLocal && apiIsLocal) {
    throw new Error(
      `Unsafe runtime config: frontend origin ${currentOrigin} cannot target local API origin ${apiUrl.origin}.`,
    );
  }

  if (!currentIsLocal && apiUrl.protocol !== "https:") {
    throw new Error(
      `Unsafe runtime config: frontend origin ${currentOrigin} must use an HTTPS API target, received ${apiUrl.origin}.`,
    );
  }

  if (env.appOrigin && env.appOrigin !== currentOrigin) {
    throw new Error(
      `Frontend origin mismatch: NEXT_PUBLIC_APP_URL expects ${env.appOrigin}, but the browser is running on ${currentOrigin}.`,
    );
  }

  runtimeValidated = true;
}

function parseAbsoluteUrl(value: string, fallback: string) {
  try {
    return new URL(value);
  } catch {
    return new URL(fallback);
  }
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalLikeHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    isPrivate172Range(hostname)
  );
}

function isPrivate172Range(hostname: string) {
  const match = /^172\.(\d{1,3})\./.exec(hostname);
  if (!match) {
    return false;
  }

  const segment = Number(match[1]);
  return Number.isFinite(segment) && segment >= 16 && segment <= 31;
}
