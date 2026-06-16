import { NextResponse } from "next/server";
import { buildAccountDeletionPlan } from "@ai-oss/auth";
import { buildPrivacyRequestRow } from "@ai-oss/compliance";
import { createDefaultJobRegistry } from "@ai-oss/jobs";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { recordTransparencyEvent } from "@/lib/compliance-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

const registry = createDefaultJobRegistry();

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-delete-request", "Expected a JSON object body.");
  }

  if (
    !["DELETE MY ACCOUNT", "DELETE"].includes(String(body.confirmation)) ||
    !(
      body.consequencesAcknowledged === true ||
      body.consequencesAcknowledged === "true" ||
      body.deletion_consequences_acknowledged === "true"
    )
  ) {
    return problem(
      400,
      "delete-confirmation-required",
      "Deletion requires confirmation text and consequence acknowledgement.",
    );
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "account_delete_export",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const userId = auth.user.id;
  const requestedAt = new Date().toISOString();
  const [posts, comments, papers, chatMessages] = await Promise.all([
    service.client
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    service.client
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    service.client
      .from("papers")
      .select("id", { count: "exact", head: true })
      .eq("submitter_id", userId)
      .in("status", ["published", "withdrawn", "superseded", "retracted"]),
    service.client
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
  ]);

  const plan = buildAccountDeletionPlan({
    userId,
    requestedAt,
    hasLegalHold: false,
    publicPosts: posts.count ?? 0,
    publicComments: comments.count ?? 0,
    publishedPapers: papers.count ?? 0,
    privateChatMessages: chatMessages.count ?? 0,
  });

  const requestRow = buildPrivacyRequestRow({
    userId,
    requestType: "delete",
    message: "Self-service account deletion.",
    now: new Date(requestedAt),
  });
  const privacyRequest = await service.client
    .from("privacy_requests")
    .insert({
      ...requestRow,
      details: { ...requestRow.details, plan },
    })
    .select("*")
    .single();

  const job = await registry.run({
    name: "account_deletion_anonymization",
    payload: {
      user_id: userId,
      requested_at: requestedAt,
      plan: JSON.parse(JSON.stringify(plan)),
    },
    idempotencyKey: `account_deletion:${userId}:${requestedAt.slice(0, 10)}`,
  });

  if (privacyRequest.data?.id !== undefined) {
    await recordTransparencyEvent(service.client, {
      eventType: "privacy.delete",
      subjectType: "privacy_request",
      subjectId: privacyRequest.data.id,
      privacyRequestId: privacyRequest.data.id,
      publicBucket: "delete",
      metadata: { selfService: true },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      requestType: "delete",
      plan,
      job,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
