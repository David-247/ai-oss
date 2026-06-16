import { NextResponse } from "next/server";
import { buildPublicReputation } from "@ai-oss/trust";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { readString } from "@/lib/discussions-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const url = new URL(request.url);
  const userId = readString(url.searchParams.get("userId") ?? url.searchParams.get("user_id"));
  if (!userId) {
    return problem(400, "reputation-user-required", "userId is required.");
  }

  const { data, error } = await service.client
    .from("profiles")
    .select("id, username, display_name, reputation_score, public_reputation, contribution_summary")
    .eq("id", userId)
    .maybeSingle();
  if (error !== null) {
    return problem(400, "reputation-profile-read-failed", error.message);
  }
  if (data === null) {
    return problem(404, "reputation-profile-not-found", "Profile does not exist.");
  }

  const reputation = isRecord(data.public_reputation)
    ? data.public_reputation
    : isRecord(data.contribution_summary)
      ? data.contribution_summary
      : {};
  return NextResponse.json(
    {
      profile: {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
      },
      reputation: buildPublicReputation({
        communityKarma: Number(data.reputation_score ?? reputation.communityKarma ?? 0),
        researchContributionScore: Number(reputation.researchContributionScore ?? 0),
        reviewHelpfulnessScore: Number(reputation.reviewHelpfulnessScore ?? 0),
        replicationContributionScore: Number(reputation.replicationContributionScore ?? 0),
        zoneReputation: isRecord(reputation.zoneReputation)
          ? readZoneReputation(reputation.zoneReputation)
          : {},
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function readZoneReputation(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, score]) => {
      const number = Number(score);
      return Number.isFinite(number) ? [[key, number]] : [];
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
