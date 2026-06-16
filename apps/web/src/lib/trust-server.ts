import { createHash } from "node:crypto";
import {
  buildAbuseRateLimitEventRow,
  evaluateSensitiveActionGuard,
  sensitiveActionWindow,
  type SensitiveAction,
  type SensitiveActionGuardDecision,
} from "@ai-oss/trust";
import type { SupabaseClient } from "@ai-oss/auth";
import { problem } from "@/lib/auth-server";
import { readString } from "@/lib/discussions-server";

type SupabaseServiceClient = SupabaseClient;

export async function enforceSensitiveAction(input: {
  client: SupabaseServiceClient;
  request: Request;
  userId: string;
  action: SensitiveAction;
  emailVerified: boolean;
  similarityScore?: number;
  highRiskZone?: boolean;
}) {
  const [profile, security] = await Promise.all([
    input.client
      .from("profiles")
      .select("id, trust_score, created_at, suspended_at")
      .eq("id", input.userId)
      .maybeSingle(),
    input.client
      .from("user_security_state")
      .select("mfa_enrolled, passkey_enrolled, risk_level, risk_score, device_risk")
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);
  if (profile.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "trust-profile-read-failed", profile.error.message),
    };
  }
  if (security.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "trust-security-read-failed", security.error.message),
    };
  }

  const window = sensitiveActionWindow({ action: input.action });
  const recent = await input.client
    .from("abuse_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", input.userId)
    .eq("action", input.action)
    .gte("created_at", window.since);
  if (recent.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "trust-rate-limit-read-failed", recent.error.message),
    };
  }

  const bot = readBotSignal(input.request);
  const decision = evaluateSensitiveActionGuard({
    action: input.action,
    accountAgeDays: accountAgeDays(profile.data?.created_at),
    emailVerified: input.emailVerified,
    trustScore: Number(profile.data?.trust_score ?? 0),
    riskLevel: profile.data?.suspended_at ? "suspended" : readRiskLevel(security.data?.risk_level),
    mfaEnabled: security.data?.mfa_enrolled === true,
    passkeyEnabled: security.data?.passkey_enrolled === true,
    csrfVerified: csrfVerified(input.request),
    botVerified: bot.verified,
    botScore: bot.score,
    recentActionCount: recent.count ?? 0,
    actionLimit: window.limit,
    windowSeconds: window.windowSeconds,
    similarityScore: input.similarityScore,
    deviceRiskScore: readDeviceRisk(security.data?.device_risk),
    ipRiskScore: Number(security.data?.risk_score ?? 0) / 100,
    highRiskZone: input.highRiskZone,
  });

  const row = buildAbuseRateLimitEventRow({
    actorId: input.userId,
    action: input.action,
    bucket: window.bucket,
    allowed: decision.allowed,
    reason: decision.reasons.join(", ") || null,
    ipHash: hashNullable(readRequestIp(input.request)),
    deviceHash: hashNullable(input.request.headers.get("x-device-id")),
    botScore: bot.score ?? null,
    metadata: {
      requirements: decision.requirements,
      retry_after_seconds: decision.retryAfterSeconds,
      bot_challenge_required: decision.botChallengeRequired,
    },
  });
  const logged = await input.client.from("abuse_rate_limit_events").insert(row);
  if (logged.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "trust-rate-limit-log-failed", logged.error.message),
    };
  }

  if (!decision.allowed) {
    return {
      ok: false as const,
      response: trustDecisionProblem(decision),
      decision,
    };
  }
  return { ok: true as const, decision, profile: profile.data, security: security.data };
}

export function trustDecisionProblem(decision: SensitiveActionGuardDecision) {
  return Response.json(
    {
      type: "https://www.ai-oss.net/errors/sensitive-action-denied",
      title: "Sensitive action rejected",
      status: decision.status,
      detail: decision.reasons.join(", "),
      reasons: decision.reasons,
      requirements: decision.requirements,
      retryAfterSeconds: decision.retryAfterSeconds,
      botChallengeRequired: decision.botChallengeRequired,
    },
    {
      status: decision.status,
      headers: {
        "Cache-Control": "no-store",
        ...(decision.retryAfterSeconds > 0
          ? { "Retry-After": String(decision.retryAfterSeconds) }
          : {}),
      },
    },
  );
}

export function readEmailVerified(user: unknown): boolean {
  return (
    typeof user === "object" &&
    user !== null &&
    "email_confirmed_at" in user &&
    typeof user.email_confirmed_at === "string"
  );
}

function csrfVerified(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie.includes("sb-access-token=")) {
    return true;
  }
  if (request.headers.get("x-csrf-verified") === "true") {
    return true;
  }
  const origin = request.headers.get("origin");
  if (origin === null) {
    return false;
  }
  const host = request.headers.get("host");
  return Boolean(host && origin.includes(host));
}

function readBotSignal(request: Request): { verified: boolean; score?: number } {
  const score = Number(request.headers.get("x-bot-score"));
  const enforcementRequired = process.env.TRUST_BOTID_ENFORCEMENT === "required";
  const status = readString(
    request.headers.get("x-vercel-botid-status") ?? request.headers.get("x-botid-status"),
  );
  if (!enforcementRequired && !status && !Number.isFinite(score)) {
    return { verified: true };
  }
  return {
    verified: status === "verified" || (Number.isFinite(score) && score < 0.75),
    ...(Number.isFinite(score) ? { score } : {}),
  };
}

function readRiskLevel(value: unknown) {
  return value === "elevated" || value === "restricted" || value === "suspended" ? value : "normal";
}

function readDeviceRisk(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || !("score" in value)) {
    return undefined;
  }
  const score = Number(value.score);
  return Number.isFinite(score) ? score : undefined;
}

function accountAgeDays(createdAt: unknown): number {
  const created = typeof createdAt === "string" ? new Date(createdAt) : new Date();
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000));
}

function readRequestIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")
  );
}

function hashNullable(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return createHash("sha256").update(value).digest("hex");
}
