import { NextResponse } from "next/server";
import { serializePrivacyExport } from "@ai-oss/auth";
import { buildPrivacyRequestRow } from "@ai-oss/compliance";
import { createDefaultJobRegistry } from "@ai-oss/jobs";
import { getServiceClientOrProblem, requireAuthenticatedUser } from "@/lib/auth-server";
import { recordTransparencyEvent } from "@/lib/compliance-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

const registry = createDefaultJobRegistry();

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
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
  const idempotencyKey = `privacy_export:${userId}:${requestedAt.slice(0, 10)}`;

  const requestRow = buildPrivacyRequestRow({
    userId,
    requestType: "export",
    message: "Self-service privacy export.",
    now: new Date(requestedAt),
  });
  const privacyRequest = await service.client
    .from("privacy_requests")
    .insert(requestRow)
    .select("*")
    .single();

  const [
    profile,
    settings,
    zoneMemberships,
    posts,
    comments,
    papers,
    reviews,
    replicationReports,
    votes,
    donations,
    consentEvents,
  ] = await Promise.all([
    service.client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    service.client.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    service.client.from("zone_members").select("*").eq("user_id", userId),
    service.client.from("posts").select("*").eq("author_id", userId),
    service.client.from("comments").select("*").eq("author_id", userId),
    service.client.from("papers").select("*").eq("submitter_id", userId),
    service.client.from("paper_reviews").select("*").eq("reviewer_id", userId),
    service.client.from("replication_reports").select("*").eq("reporter_id", userId),
    service.client.from("votes").select("*").eq("user_id", userId),
    service.client.from("donations").select("*").eq("user_id", userId),
    service.client.from("consent_events").select("*").eq("user_id", userId),
  ]);

  const exportDocument = serializePrivacyExport(
    {
      profile: profile.data,
      settings: settings.data,
      zoneMemberships: zoneMemberships.data ?? [],
      posts: posts.data ?? [],
      comments: comments.data ?? [],
      papers: papers.data ?? [],
      reviews: reviews.data ?? [],
      replicationReports: replicationReports.data ?? [],
      votes: votes.data ?? [],
      moderationHistory: [],
      donations: donations.data ?? [],
      consentEvents: consentEvents.data ?? [],
    },
    requestedAt,
  );

  const job = await registry.run({
    name: "privacy_export",
    payload: { user_id: userId, requested_at: requestedAt },
    idempotencyKey,
  });

  if (privacyRequest.data?.id !== undefined) {
    await recordTransparencyEvent(service.client, {
      eventType: "privacy.export",
      subjectType: "privacy_request",
      subjectId: privacyRequest.data.id,
      privacyRequestId: privacyRequest.data.id,
      publicBucket: "export",
      metadata: { selfService: true },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      requestType: "export",
      job,
      export: exportDocument,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
