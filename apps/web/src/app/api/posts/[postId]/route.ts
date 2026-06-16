import { NextResponse } from "next/server";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadPostAccess, readString, readStringArray } from "@/lib/discussions-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  const { postId } = await context.params;
  const access = await loadPostAccess(service.client, postId, user.userId);
  if (!access.ok) {
    return access.response;
  }
  if (!access.canRead) {
    return problem(403, "post-read-denied", "Post is not visible to this session.");
  }

  return NextResponse.json(
    {
      post: serializePost(access.post),
      permissions: {
        canComment: access.canComment,
        canEdit: access.authorOwnsPost,
        canModerate: access.canModerate,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { postId } = await context.params;

  const access = await loadPostAccess(service.client, postId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.authorOwnsPost && !access.canModerate) {
    return problem(403, "post-update-denied", "Only the author or a moderator can update a post.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-post-update", "Expected a JSON object body.");
  }

  const moderationPatch = readModerationPatch(body, access.canModerate);
  if (moderationPatch.requiresModerator && !access.canModerate) {
    return problem(403, "post-moderation-denied", "Post moderation requires a moderator.");
  }
  if (access.post.is_locked === true && !access.canModerate) {
    return problem(409, "post-locked", "Locked posts can only be edited by moderators.");
  }

  let authorPatch: Record<string, unknown>;
  try {
    authorPatch = readAuthorPatch(body);
  } catch (error) {
    return problem(
      400,
      "invalid-post-update",
      error instanceof Error ? error.message : "Post update is invalid.",
    );
  }

  const patch = {
    ...authorPatch,
    ...moderationPatch.patch,
  };
  if (Object.keys(patch).length === 0) {
    return problem(400, "empty-post-update", "No supported post fields provided.");
  }

  const { data, error } = await service.client
    .from("posts")
    .update(patch)
    .eq("id", postId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "post-update-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, post: serializePost(data) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { postId } = await context.params;
  const access = await loadPostAccess(service.client, postId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.authorOwnsPost && !access.canModerate) {
    return problem(403, "post-delete-denied", "Only the author or a moderator can delete a post.");
  }

  const { data, error } = await service.client
    .from("posts")
    .update({
      status: "deleted",
      body: null,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "post-delete-failed", error.message);
  }

  return NextResponse.json({ ok: true, post: data }, { headers: { "Cache-Control": "no-store" } });
}

async function maybeAuthenticatedUser(request: Request) {
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

function readAuthorPatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if ("title" in body) {
    const title = readString(body.title);
    if (title.length >= 5 && title.length <= 220) {
      patch.title = title;
    }
  }
  if ("body" in body) {
    patch.body = readString(body.body) || null;
  }
  if ("url" in body) {
    patch.url = normalizeOptionalHttpUrl(body.url);
  }
  if ("tags" in body) {
    patch.tags = readStringArray(body.tags);
  }
  if (body.visibility === "public" || body.visibility === "zone" || body.visibility === "private") {
    patch.visibility = body.visibility;
  }
  return patch;
}

function readModerationPatch(
  body: Record<string, unknown>,
  canModerate: boolean,
): { requiresModerator: boolean; patch: Record<string, unknown> } {
  const patch: Record<string, unknown> = {};
  let requiresModerator = false;

  if ("isLocked" in body || "is_locked" in body) {
    requiresModerator = true;
    patch.is_locked = body.isLocked === true || body.is_locked === true;
    patch.status = patch.is_locked === true ? "locked" : "published";
  }
  if (body.status === "locked" || body.status === "published" || body.status === "removed") {
    requiresModerator = true;
    patch.status = body.status;
    patch.is_locked = body.status === "locked";
  }
  if (body.moderationStatus === "removed" || body.moderation_status === "removed") {
    requiresModerator = true;
    patch.moderation_status = "removed";
    patch.status = "removed";
  }
  if ("removalReason" in body || "removal_reason" in body) {
    requiresModerator = true;
    patch.removal_reason = readString(body.removalReason ?? body.removal_reason) || null;
  }
  if (patch.status === "removed") {
    patch.moderation_status = "removed";
  }

  return {
    requiresModerator: requiresModerator && !canModerate,
    patch,
  };
}

function normalizeOptionalHttpUrl(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) {
    return null;
  }
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported URL protocol.");
  }
  return parsed.toString();
}

function serializePost(row: Record<string, unknown>) {
  const hiddenUntil = readString(row.vote_visibility_until);
  const scoreHidden = hiddenUntil.length > 0 && new Date(hiddenUntil).getTime() > Date.now();
  return {
    ...row,
    score: scoreHidden ? null : row.score,
    certified_score: scoreHidden ? null : row.certified_score,
    score_hidden: scoreHidden,
  };
}
