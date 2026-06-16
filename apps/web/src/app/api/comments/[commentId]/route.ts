import { NextResponse } from "next/server";
import {
  buildCommentEditPatch,
  buildDeletedCommentPatch,
  collapseRemovedComment,
} from "@ai-oss/discussions";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  isRecord,
  loadCommentAccess,
  readString,
  refreshPostCommentCount,
} from "@/lib/discussions-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ commentId: string }>;
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

  const { commentId } = await context.params;
  const access = await loadCommentAccess(service.client, commentId, user.userId);
  if (!access.ok) {
    return access.response;
  }
  if (!access.canRead) {
    return problem(403, "comment-read-denied", "Comment is not visible to this session.");
  }

  return NextResponse.json(
    {
      comment: access.comment,
      permissions: {
        canEdit: access.canEdit,
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
  const { commentId } = await context.params;
  const access = await loadCommentAccess(service.client, commentId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-comment-update", "Expected a JSON object body.");
  }

  const patch: Record<string, unknown> = {};
  if ("body" in body) {
    if (!access.canEdit && !access.canModerate) {
      return problem(403, "comment-edit-denied", "Comment edit is not allowed.");
    }
    Object.assign(
      patch,
      buildCommentEditPatch({
        previousBody: readString(access.comment.body),
        previousEditHistory: access.comment.edit_history,
        newBody: readString(body.body),
        editorId: auth.user.id,
        reason: readString(body.reason),
      }),
    );
  }

  const moderationPatch = readModerationPatch(body, access, auth.user.id);
  if (!moderationPatch.ok) {
    return moderationPatch.response;
  }
  Object.assign(patch, moderationPatch.patch);

  if (Object.keys(patch).length === 0) {
    return problem(400, "empty-comment-update", "No supported comment fields provided.");
  }

  const { data, error } = await service.client
    .from("comments")
    .update(patch)
    .eq("id", commentId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "comment-update-failed", error.message);
  }

  if (access.postId !== null) {
    await refreshPostCommentCount(service.client, access.postId);
  }

  return NextResponse.json(
    { ok: true, comment: data },
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
  const { commentId } = await context.params;
  const access = await loadCommentAccess(service.client, commentId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.authorOwnsComment && !access.canModerate) {
    return problem(
      403,
      "comment-delete-denied",
      "Only the author or a moderator can delete a comment.",
    );
  }

  const { data, error } = await service.client
    .from("comments")
    .update(buildDeletedCommentPatch())
    .eq("id", commentId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "comment-delete-failed", error.message);
  }

  if (access.postId !== null) {
    await refreshPostCommentCount(service.client, access.postId);
  }

  return NextResponse.json(
    { ok: true, comment: data },
    { headers: { "Cache-Control": "no-store" } },
  );
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

function readModerationPatch(
  body: Record<string, unknown>,
  access: {
    canModerate: boolean;
    comment: Record<string, unknown>;
  },
  actorId: string,
) {
  const patch: Record<string, unknown> = {};
  const requestsModeration =
    "isLocked" in body ||
    "is_locked" in body ||
    body.status === "removed" ||
    body.moderationStatus === "removed" ||
    body.moderation_status === "removed" ||
    "removalReason" in body ||
    "removal_reason" in body;

  if (!requestsModeration) {
    return { ok: true as const, patch };
  }
  if (!access.canModerate) {
    return {
      ok: false as const,
      response: problem(
        403,
        "comment-moderation-denied",
        "Comment moderation requires a moderator.",
      ),
    };
  }

  if ("isLocked" in body || "is_locked" in body) {
    patch.is_locked = body.isLocked === true || body.is_locked === true;
    patch.status = patch.is_locked === true ? "locked" : "published";
  }
  if (
    body.status === "removed" ||
    body.moderationStatus === "removed" ||
    body.moderation_status === "removed"
  ) {
    const reason = readString(body.removalReason ?? body.removal_reason);
    if (!reason) {
      return {
        ok: false as const,
        response: problem(400, "comment-removal-reason-required", "Removal reason is required."),
      };
    }
    Object.assign(
      patch,
      collapseRemovedComment({
        actorId,
        reason,
        previousBody: readString(access.comment.body),
        previousEditHistory: access.comment.edit_history,
      }),
    );
  }
  if ("removalReason" in body || "removal_reason" in body) {
    patch.removal_reason = readString(body.removalReason ?? body.removal_reason) || null;
  }

  return { ok: true as const, patch };
}
