import { NextResponse } from "next/server";
import { checkPermission, type PermissionScope } from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import {
  QUARANTINE_BUCKET,
  validateUploadRequest,
  type PaperFileKind,
  type UploadContext,
} from "@ai-oss/files";
import {
  evaluateUploadCostControl,
  type TrustTier,
} from "@ai-oss/performance";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { loadActorContext, readRequestBody, readString } from "@/lib/permissions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-upload-url-request", "Expected a JSON object body.");
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "research_upload",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const input = {
    ownerId: auth.user.id,
    uploaderId: auth.user.id,
    filename: readString(body.filename),
    contentType: readString(body.contentType) || readString(body.content_type),
    sizeBytes: readNumber(body.sizeBytes ?? body.size_bytes),
    context: readString(body.context) as UploadContext,
    zoneId: readString(body.zoneId ?? body.zone_id) || null,
    paperId: readString(body.paperId ?? body.paper_id) || null,
    paperVersionId: readString(body.paperVersionId ?? body.paper_version_id) || null,
    fileKind: (readString(body.fileKind ?? body.file_kind) || undefined) as
      | PaperFileKind
      | undefined,
  };

  const decision = validateUploadRequest(input);
  if (!decision.allowed || decision.storageKey === undefined) {
    return problem(400, "upload-rejected", decision.reason ?? "Upload request rejected.");
  }

  const cost = await readUploadCostState(service.client, auth.user.id);
  if (!cost.ok) {
    return cost.response;
  }
  const costDecision = evaluateUploadCostControl({
    trustTier: trustTierForScore(Number(trustGate.profile?.trust_score ?? 0)),
    sizeBytes: input.sizeBytes,
    storageUsedBytes: cost.storageUsedBytes,
    uploadedTodayBytes: cost.uploadedTodayBytes,
  });
  if (!costDecision.allowed) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/upload-cost-quota-exceeded",
        title: "Request rejected",
        status: 429,
        detail: costDecision.reasons.join(", "),
        reasons: costDecision.reasons,
        quota: costDecision.quota,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (decision.requiredPermission !== null) {
    const actor = await loadActorContext(service.client, auth.user.id);
    const permission = checkPermission({
      actor,
      scope: decision.requiredPermission as PermissionScope,
      resource: { ownerId: auth.user.id, zoneId: input.zoneId },
    });
    if (!permission.allowed) {
      return problem(
        403,
        "upload-permission-denied",
        `Missing ${decision.requiredPermission}: ${permission.reasons.join(", ")}`,
      );
    }
  }

  let signed: Awaited<ReturnType<typeof createSignedUploadUrl>>;
  try {
    signed = await createSignedUploadUrl(service.client, decision.storageKey);
  } catch (error) {
    return problem(
      500,
      "signed-upload-url-failed",
      error instanceof Error ? error.message : String(error),
    );
  }

  return NextResponse.json(
    {
      upload: {
        provider: "supabase",
        bucket: QUARANTINE_BUCKET,
        storageKey: decision.storageKey,
        signedUrl: signed.signedUrl,
        token: signed.token,
        expiresInSeconds: signed.expiresInSeconds,
      },
      policy: {
        fileType: decision.fileType,
        maxBytes: decision.maxBytes,
        detectedMime: decision.detectedMime,
        requiredPermission: decision.requiredPermission,
        costControl: {
          trustTier: trustTierForScore(Number(trustGate.profile?.trust_score ?? 0)),
          quota: costDecision.quota,
        },
      },
      quarantine: true,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function createSignedUploadUrl(client: SupabaseClient, storageKey: string) {
  const bucket = client.storage.from(QUARANTINE_BUCKET);
  const { data, error } = await bucket.createSignedUploadUrl(storageKey);
  if (error !== null) {
    throw new Error(error.message);
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    expiresInSeconds: 7200,
  };
}

function readNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readUploadCostState(client: SupabaseClient, ownerId: string) {
  const today = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [allFiles, recentFiles] = await Promise.all([
    client.from("files").select("size_bytes").eq("owner_id", ownerId).is("deleted_at", null).limit(1000),
    client
      .from("files")
      .select("size_bytes")
      .eq("owner_id", ownerId)
      .gte("created_at", today)
      .is("deleted_at", null)
      .limit(1000),
  ]);
  if (allFiles.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "upload-storage-quota-read-failed", allFiles.error.message),
    };
  }
  if (recentFiles.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "upload-daily-quota-read-failed", recentFiles.error.message),
    };
  }
  return {
    ok: true as const,
    storageUsedBytes: sumSizeBytes(allFiles.data ?? []),
    uploadedTodayBytes: sumSizeBytes(recentFiles.data ?? []),
  };
}

function sumSizeBytes(rows: readonly { size_bytes?: unknown }[]): number {
  return rows.reduce((sum, row) => {
    const size = Number(row.size_bytes ?? 0);
    return Number.isFinite(size) ? sum + size : sum;
  }, 0);
}

function trustTierForScore(score: number): TrustTier {
  if (score < 0) {
    return "restricted";
  }
  if (score < 10) {
    return "new";
  }
  if (score >= 75) {
    return "research_partner";
  }
  if (score >= 40) {
    return "trusted";
  }
  return "normal";
}
