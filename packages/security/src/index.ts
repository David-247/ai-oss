export const PACKAGE_NAME = "@ai-oss/security" as const;

export const SAFE_HTTP_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export const SECURITY_HEADER_NAMES = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "X-DNS-Prefetch-Control",
  "X-Permitted-Cross-Domain-Policies",
] as const;

export interface SecurityHeaderOptions {
  env?: "development" | "production" | "test";
  reportUri?: string | null;
  extraConnectSrc?: readonly string[];
}

export function buildSecurityHeaders(
  options: SecurityHeaderOptions = {},
): Record<(typeof SECURITY_HEADER_NAMES)[number], string> {
  const env = options.env ?? "production";
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": buildContentSecurityPolicy({
      env,
      reportUri: options.reportUri ?? null,
      extraConnectSrc: options.extraConnectSrc ?? [],
    }),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=()",
      "battery=()",
      "camera=(self)",
      "display-capture=(self)",
      "document-domain=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=(self)",
      "payment=(self)",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}

export function buildContentSecurityPolicy(input: {
  env?: "development" | "production" | "test";
  reportUri?: string | null;
  extraConnectSrc?: readonly string[];
}): string {
  const env = input.env ?? "production";
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://checkout.stripe.com",
    "https://*.vercel-insights.com",
    "https://*.vercel.app",
    ...(input.extraConnectSrc ?? []),
  ];
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (env === "development") {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'self'"],
    ["script-src", ...scriptSrc],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", "https:"],
    ["font-src", "'self'", "data:"],
    ["connect-src", ...connectSrc],
    ["frame-src", "https://checkout.stripe.com"],
    ["media-src", "'self'", "blob:"],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["upgrade-insecure-requests"],
  ];
  if (input.reportUri) {
    directives.push(["report-uri", input.reportUri]);
  }
  return directives.map((directive) => directive.join(" ")).join("; ");
}

export interface CsrfDecision {
  allowed: boolean;
  reason: string;
  requirements: string[];
}

export interface CsrfRequestInput {
  method: string;
  url: string;
  headers: HeaderLike;
  sessionCookieNames?: readonly string[];
  csrfCookieName?: string;
  csrfHeaderName?: string;
}

export interface HeaderLike {
  get(name: string): string | null;
}

export function evaluateCsrfRequest(input: CsrfRequestInput): CsrfDecision {
  const method = input.method.toUpperCase();
  if (isSafeHttpMethod(method)) {
    return allow("safe_method");
  }

  const sessionCookieNames = input.sessionCookieNames ?? ["sb-access-token", "sb-refresh-token"];
  const cookies = parseCookieHeader(input.headers.get("cookie"));
  const usesCookieBackedSession = sessionCookieNames.some((name) => cookies.has(name));
  if (!usesCookieBackedSession) {
    return allow("no_cookie_session");
  }

  if (originMatchesRequest(input.headers.get("origin"), input.url)) {
    return allow("same_origin");
  }

  if (originMatchesRequest(readRefererOrigin(input.headers.get("referer")), input.url)) {
    return allow("same_site_referer");
  }

  const csrfCookieName = input.csrfCookieName ?? "aioss_csrf";
  const csrfHeaderName = input.csrfHeaderName ?? "x-csrf-token";
  const cookieToken = cookies.get(csrfCookieName) ?? "";
  const headerToken = input.headers.get(csrfHeaderName) ?? "";
  if (cookieToken.length >= 24 && timingSafeStringEqual(cookieToken, headerToken)) {
    return allow("double_submit_token");
  }

  return {
    allowed: false,
    reason: "csrf_protection_required",
    requirements: [
      "same_origin_origin_header",
      "same_origin_referer_header",
      "double_submit_csrf_token",
    ],
  };
}

export function parseCookieHeader(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) {
    return cookies;
  }
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    const name = rawName?.trim();
    if (!name) {
      continue;
    }
    cookies.set(name, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

export function isSafeHttpMethod(method: string): boolean {
  return (SAFE_HTTP_METHODS as readonly string[]).includes(method.toUpperCase());
}

export interface SsrfDecision {
  allowed: boolean;
  normalizedUrl: string | null;
  reason: string;
}

export interface SsrfProtectionOptions {
  allowedProtocols?: readonly string[];
  allowedHosts?: readonly string[];
  blockedHosts?: readonly string[];
  requirePublicHostname?: boolean;
}

export function evaluateServerSideUrl(
  value: string,
  options: SsrfProtectionOptions = {},
): SsrfDecision {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return denyUrl("invalid_url");
  }

  const allowedProtocols = options.allowedProtocols ?? ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return denyUrl("unsupported_protocol");
  }
  if (parsed.username || parsed.password) {
    return denyUrl("embedded_credentials_blocked");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname.length === 0) {
    return denyUrl("hostname_required");
  }

  if ((options.blockedHosts ?? []).some((host) => hostname === normalizeHost(host))) {
    return denyUrl("blocked_host");
  }
  if ((options.allowedHosts ?? []).some((host) => hostname === normalizeHost(host))) {
    return allowUrl(parsed);
  }

  if (isLocalOrPrivateHost(hostname)) {
    return denyUrl("private_or_local_address_blocked");
  }
  if ((options.requirePublicHostname ?? true) && !hostname.includes(".")) {
    return denyUrl("public_hostname_required");
  }

  return allowUrl(parsed);
}

export function sanitizeServerSideUrl(
  value: string,
  options: SsrfProtectionOptions = {},
): string | null {
  const decision = evaluateServerSideUrl(value, options);
  return decision.allowed ? decision.normalizedUrl : null;
}

export const ELEVATED_ADMIN_ROLES = [
  "owner",
  "super_admin",
  "trust_safety_admin",
  "legal_admin",
  "privacy_admin_dpo",
  "security_admin",
  "finance_admin",
] as const;

export interface AdminSessionSecurityInput {
  roles: readonly string[];
  mfaEnrolled?: boolean;
  passkeyEnrolled?: boolean;
  stepUpVerifiedAt?: string | Date | null;
  sessionStartedAt?: string | Date | null;
  ipRiskScore?: number | null;
  deviceRiskScore?: number | null;
  breakGlass?: boolean;
  now?: Date;
}

export interface AdminSessionSecurityDecision {
  allowed: boolean;
  elevated: boolean;
  breakGlass: boolean;
  reasons: string[];
  requirements: string[];
  sessionExpiresAt: string | null;
  auditRequired: boolean;
}

export function evaluateAdminSessionSecurity(
  input: AdminSessionSecurityInput,
): AdminSessionSecurityDecision {
  const now = input.now ?? new Date();
  const elevated = input.roles.some((role) =>
    (ELEVATED_ADMIN_ROLES as readonly string[]).includes(role),
  );
  const breakGlass = input.breakGlass === true && input.roles.includes("owner");
  const reasons: string[] = [];
  const requirements: string[] = [];
  const sessionMaxAgeMs = 30 * 60 * 1_000;
  const stepUpMaxAgeMs = 15 * 60 * 1_000;

  const sessionStartedAt = toDate(input.sessionStartedAt);
  const sessionExpiresAt = sessionStartedAt
    ? new Date(sessionStartedAt.getTime() + sessionMaxAgeMs)
    : null;

  if (!elevated) {
    return {
      allowed: true,
      elevated,
      breakGlass: false,
      reasons,
      requirements,
      sessionExpiresAt: sessionExpiresAt?.toISOString() ?? null,
      auditRequired: false,
    };
  }

  if (breakGlass) {
    return {
      allowed: true,
      elevated,
      breakGlass,
      reasons: ["break_glass_monitoring_required"],
      requirements: ["append_only_audit", "security_alert", "post_incident_review"],
      sessionExpiresAt: sessionExpiresAt?.toISOString() ?? null,
      auditRequired: true,
    };
  }

  if (input.mfaEnrolled !== true && input.passkeyEnrolled !== true) {
    reasons.push("mfa_or_passkey_required");
    requirements.push("mfa_or_passkey");
  }
  if (!isFresh(input.stepUpVerifiedAt, now, stepUpMaxAgeMs)) {
    reasons.push("fresh_step_up_required");
    requirements.push("step_up_authentication");
  }
  if (!sessionStartedAt || sessionExpiresAt === null || sessionExpiresAt.getTime() <= now.getTime()) {
    reasons.push("admin_session_timeout");
    requirements.push("new_admin_session");
  }
  if ((input.ipRiskScore ?? 0) >= 0.8) {
    reasons.push("ip_risk_too_high");
    requirements.push("security_review");
  }
  if ((input.deviceRiskScore ?? 0) >= 0.8) {
    reasons.push("device_risk_too_high");
    requirements.push("trusted_device");
  }

  return {
    allowed: reasons.length === 0,
    elevated,
    breakGlass,
    reasons,
    requirements,
    sessionExpiresAt: sessionExpiresAt?.toISOString() ?? null,
    auditRequired: true,
  };
}

export function buildBreakGlassMonitorEvent(input: {
  actorId: string;
  reason: string;
  ipHash?: string | null;
  createdAt?: string;
}) {
  if (input.reason.trim().length < 8) {
    throw new Error("Break-glass use requires a detailed reason.");
  }
  return {
    actor_id: input.actorId,
    action: "security.break_glass_used",
    severity: "critical",
    reason: input.reason.trim(),
    ip_hash: input.ipHash ?? null,
    monitoring_required: true,
    post_incident_review_required: true,
    created_at: input.createdAt ?? new Date().toISOString(),
  };
}

export const VERCEL_WAF_RULES = [
  wafRule("admin-step-up", ["/admin", "/api/admin"], "challenge", [
    "elevated_role",
    "missing_mfa_or_passkey",
    "stale_step_up",
  ]),
  wafRule("auth-abuse", ["/api/auth"], "rate_limit", [
    "login_or_signup_post",
    "ip_velocity",
    "bot_score",
  ]),
  wafRule("account-privacy", ["/api/account/export", "/api/account/delete"], "challenge", [
    "cookie_session",
    "missing_step_up",
  ]),
  wafRule("payment-webhook-allowlist", ["/api/stripe/webhook"], "monitor", [
    "stripe_signature_required",
    "no_browser_cookies",
  ]),
  wafRule("file-upload", ["/api/files/upload-url", "/api/files/complete"], "rate_limit", [
    "content_length",
    "mime_type",
    "bot_score",
  ]),
  wafRule("legal-intake", ["/api/legal/dmca", "/api/legal/dsa", "/api/legal/online-safety"], "rate_limit", [
    "requester_velocity",
    "target_velocity",
  ]),
  wafRule("governance-vote", ["/api/zones/*/governance/actions", "/api/votes"], "challenge", [
    "botid_required",
    "duplicate_device_cluster",
  ]),
  wafRule("research-submit", ["/api/research/papers"], "rate_limit", [
    "account_age",
    "file_hash_reuse",
    "external_link_ssrf",
  ]),
] as const;

export const SUPPLY_CHAIN_CONTROLS = [
  "github_actions_ci_required",
  "codeowners_required_review",
  "dependabot_updates_enabled",
  "pnpm_lockfile_committed",
  "secret_scanning_enabled",
  "sast_codeql_or_equivalent",
  "license_scanning_required",
  "production_deploys_from_protected_branch",
  "environment_scoped_secrets",
] as const;

export function secretEnvExposureIssues(envNames: readonly string[]): string[] {
  const secretMarkers = ["SECRET", "SERVICE_ROLE", "PRIVATE_KEY", "WEBHOOK", "TOKEN"];
  return envNames.filter(
    (name) =>
      name.startsWith("NEXT_PUBLIC_") &&
      secretMarkers.some((marker) => name.toUpperCase().includes(marker)),
  );
}

function wafRule(
  key: string,
  paths: readonly string[],
  action: "block" | "challenge" | "rate_limit" | "monitor",
  signals: readonly string[],
) {
  return {
    key,
    platform: "vercel_waf",
    paths,
    action,
    signals,
    logOnlyUntilTuned: action !== "block",
  };
}

function allow(reason: string): CsrfDecision {
  return { allowed: true, reason, requirements: [] };
}

function originMatchesRequest(origin: string | null, requestUrl: string): boolean {
  if (!origin) {
    return false;
  }
  try {
    const request = new URL(requestUrl);
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === request.protocol && parsedOrigin.host === request.host;
  } catch {
    return false;
  }
}

function readRefererOrigin(referer: string | null): string | null {
  if (!referer) {
    return null;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function allowUrl(parsed: URL): SsrfDecision {
  parsed.hash = "";
  return {
    allowed: true,
    normalizedUrl: parsed.toString(),
    reason: "public_http_url",
  };
}

function denyUrl(reason: string): SsrfDecision {
  return { allowed: false, normalizedUrl: null, reason };
}

function isLocalOrPrivateHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    return true;
  }
  if (hostname === "metadata.google.internal") {
    return true;
  }
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return isPrivateIpv6(hostname.slice(1, -1));
  }
  if (hostname.includes(":")) {
    return isPrivateIpv6(hostname);
  }
  return isPrivateIpv4(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a = 0, b = 0] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("ff")
  );
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isFresh(value: string | Date | null | undefined, now: Date, maxAgeMs: number): boolean {
  const parsed = toDate(value);
  if (parsed === null) {
    return false;
  }
  const ageMs = now.getTime() - parsed.getTime();
  return ageMs >= 0 && ageMs <= maxAgeMs;
}
