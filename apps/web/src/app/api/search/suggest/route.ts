import { NextResponse } from "next/server";
import {
  buildSuggestions,
  canReadSearchDocument,
  normalizeSearchQuery,
  parseSearchTargetTypes,
  type SearchResult,
} from "@ai-oss/search";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { loadSearchViewer, maybeAuthenticatedUser } from "@/lib/search-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  const url = new URL(request.url);
  const queryText = normalizeSearchQuery(url.searchParams.get("q"));
  const targetTypes = parseSearchTargetTypes(url.searchParams.get("type"));
  const viewer = await loadSearchViewer(service.client, user.userId);
  let query = service.client
    .from("search_documents")
    .select("target_type, target_id, visibility, zone_id, title, body, metadata")
    .is("deleted_at", null)
    .eq("is_fresh", true)
    .in("target_type", targetTypes)
    .limit(50);
  if (queryText) {
    query = query.ilike("title", `%${queryText}%`);
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "search-suggest-failed", error.message);
  }
  const visible = ((data ?? []) as SearchResult[]).filter((row) =>
    canReadSearchDocument(row, viewer),
  );

  return NextResponse.json(
    { suggestions: buildSuggestions(visible, queryText, 10) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
