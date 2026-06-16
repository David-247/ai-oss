import { checkPermission } from "@ai-oss/permissions";
import type { SearchViewer } from "@ai-oss/search";
import type { SupabaseClient } from "@ai-oss/auth";
import { requireAuthenticatedUser } from "@/lib/auth-server";
import { loadActorContext } from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";

type SupabaseServiceClient = SupabaseClient;

export async function maybeAuthenticatedUser(request: Request) {
  const hasToken =
    request.headers.get("authorization") !== null ||
    (request.headers.get("cookie") ?? "").includes("sb-access-token=");
  if (!hasToken) {
    return { ok: true as const, userId: null };
  }
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth;
  }
  return { ok: true as const, userId: auth.user.id };
}

export async function loadSearchViewer(
  client: SupabaseServiceClient,
  userId: string | null,
): Promise<SearchViewer> {
  if (userId === null) {
    return {
      userId: null,
      authenticated: false,
      readableZoneIds: [],
      moderatorZoneIds: [],
      canReadAdmin: false,
    };
  }

  const [memberships, actor] = await Promise.all([
    client
      .from("zone_members")
      .select("zone_id, member_role, status")
      .eq("user_id", userId)
      .in("status", ["active", "muted"]),
    loadActorContext(client, userId),
  ]);
  const memberRows = memberships.data ?? [];
  const readableZoneIds = memberRows
    .map((membership) => readString(membership.zone_id))
    .filter(Boolean);
  const moderatorZoneIds = memberRows
    .filter((membership) => {
      const role = readString(membership.member_role);
      return role === "moderator" || role === "admin";
    })
    .map((membership) => readString(membership.zone_id))
    .filter(Boolean);
  const adminDecision = checkPermission({ actor, scope: "search.read", resource: {} });

  return {
    userId,
    authenticated: true,
    readableZoneIds: Array.from(new Set(readableZoneIds)),
    moderatorZoneIds: Array.from(new Set(moderatorZoneIds)),
    canReadAdmin: adminDecision.allowed,
  };
}

export function jobSecretAuthorized(request: Request): boolean {
  const expected = process.env.JOB_TRIGGER_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  return bearer === expected || request.headers.get("x-job-secret") === expected;
}

export function searchOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
