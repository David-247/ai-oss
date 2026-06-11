// REQ-CORE-002: apex `ai-oss.net` MUST permanently redirect (HTTP 308) to the
// `www` canonical host. Logic is factored out as a pure function so it can be
// unit-tested without a running Next.js runtime (see tests/integration).

export const CANONICAL_HOST = "www.ai-oss.net";
export const APEX_HOST = "ai-oss.net";

/** HTTP 308 — Permanent Redirect, method-preserving (§2 / §4). */
export const PERMANENT_REDIRECT_STATUS = 308 as const;

export interface CanonicalRedirect {
  status: typeof PERMANENT_REDIRECT_STATUS;
  location: string;
}

/**
 * Given the incoming Host header and full request URL, return the canonical
 * redirect to apply, or `null` if the request is already canonical.
 *
 * Only the bare apex (`ai-oss.net`, optionally with a port) is redirected.
 * Local hosts (localhost, 127.0.0.1, *.vercel.app preview URLs) are left
 * untouched so dev and preview environments work normally.
 */
export function resolveCanonicalRedirect(
  host: string | null,
  requestUrl: string,
): CanonicalRedirect | null {
  if (!host) return null;

  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if (hostname !== APEX_HOST) return null;

  const url = new URL(requestUrl);
  url.host = CANONICAL_HOST;
  url.protocol = "https:";

  return { status: PERMANENT_REDIRECT_STATUS, location: url.toString() };
}
