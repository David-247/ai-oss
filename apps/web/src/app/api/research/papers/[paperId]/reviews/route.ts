import { NextResponse } from "next/server";
import { buildReviewInsertRow } from "@ai-oss/research";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadPaperAccess, readString } from "@/lib/research-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ paperId: string }>;
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
  const { paperId } = await context.params;
  const access = await loadPaperAccess(service.client, paperId, user.userId);
  if (!access.ok) {
    return access.response;
  }
  if (!access.canRead) {
    return problem(403, "paper-read-denied", "Paper is not visible to this session.");
  }

  const { data, error } = await service.client
    .from("paper_reviews")
    .select("*, profiles(username, display_name)")
    .eq("paper_id", readString(access.paper.id))
    .eq("status", "published")
    .neq("moderation_status", "removed")
    .order("created_at", { ascending: false });
  if (error !== null) {
    return problem(400, "paper-reviews-read-failed", error.message);
  }

  return NextResponse.json({ reviews: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { paperId } = await context.params;
  const access = await loadPaperAccess(service.client, paperId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.canRead) {
    return problem(403, "paper-review-denied", "Paper is not visible to this session.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-review-request", "Expected a JSON object body.");
  }
  const reviewType = readString(body.reviewType ?? body.review_type);
  if (reviewType === "author_response") {
    const verified = await isVerifiedAuthor(
      service.client,
      readString(access.paper.id),
      auth.user.id,
    );
    if (!verified) {
      return problem(
        403,
        "author-response-denied",
        "Author responses require the submitter or a linked paper author profile.",
      );
    }
  }

  let row;
  try {
    row = buildReviewInsertRow({
      paperId: readString(access.paper.id),
      paperVersionId: readString(body.paperVersionId ?? body.paper_version_id) || null,
      reviewerId: auth.user.id,
      reviewType:
        reviewType === "safety" || reviewType === "author_response" ? reviewType : "structured",
      body: readString(body.body),
      scores: isRecord(body.scores) ? body.scores : body,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-review",
      error instanceof Error ? error.message : "Review is invalid.",
    );
  }

  const { data, error } = await service.client
    .from("paper_reviews")
    .insert(row)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "paper-review-create-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, review: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
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

async function isVerifiedAuthor(
  client: Parameters<typeof loadPaperAccess>[0],
  paperId: string,
  userId: string,
): Promise<boolean> {
  const [paper, author] = await Promise.all([
    client.from("papers").select("submitter_id").eq("id", paperId).maybeSingle(),
    client
      .from("paper_authors")
      .select("profile_id")
      .eq("paper_id", paperId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);
  return paper.data?.submitter_id === userId || author.data?.profile_id === userId;
}
