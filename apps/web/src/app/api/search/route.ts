import { NextResponse } from "next/server";
import {
  buildSearchDocumentPurgePatch,
  buildSearchDocumentUpsertRow,
  buildSearchFacets,
  canReadSearchDocument,
  normalizeSearchQuery,
  parseSearchTargetTypes,
  rankSearchResult,
  SEARCH_VISIBILITIES,
  type SearchTargetType,
  type SearchVisibility,
  type SearchResult,
} from "@ai-oss/search";
import { buildCursorWindow, pageFromRows } from "@ai-oss/performance";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";
import { jobSecretAuthorized, loadSearchViewer, maybeAuthenticatedUser } from "@/lib/search-server";

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
  const zoneId = readString(url.searchParams.get("zoneId"));
  const pageWindow = buildCursorWindow({
    limit: url.searchParams.get("limit"),
    cursor: url.searchParams.get("cursor"),
    defaultLimit: 20,
    maxLimit: 50,
  });
  const viewer = await loadSearchViewer(service.client, user.userId);

  let query = service.client
    .from("search_documents")
    .select(
      "id, target_type, target_id, visibility, zone_id, title, body, metadata, source_updated_at, indexed_at",
    )
    .is("deleted_at", null)
    .eq("is_fresh", true)
    .in("target_type", targetTypes)
    .order("indexed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(200, pageWindow.fetchLimit * 8));
  if (pageWindow.cursor !== null) {
    query = query.lt("indexed_at", pageWindow.cursor.sortValue);
  }
  if (zoneId) {
    query = query.eq("zone_id", zoneId);
  }
  if (queryText) {
    query = query.textSearch("tsv", queryText, { type: "websearch", config: "english" });
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "search-query-failed", error.message);
  }

  const visible = ((data ?? []) as SearchResult[]).filter((row) =>
    canReadSearchDocument(row, viewer),
  );
  const ranked = visible
    .map((row) => ({
      ...row,
      rank: rankSearchResult({ row, query: queryText }),
      body: summarize(row.body),
    }))
    .sort((left, right) => (right.rank ?? 0) - (left.rank ?? 0));
  const page = pageFromRows(ranked, pageWindow, (result) => ({
    sortValue: readString(result.indexed_at),
    id: readString(result.id),
  }));

  return NextResponse.json(
    {
      query: queryText,
      mode: "hybrid",
      semantic: {
        enabled: false,
        reason: "Embedding generation/query vectors are asynchronous Phase 02 jobs.",
      },
      results: page.items,
      facets: buildSearchFacets(visible),
      page: page.page,
      performance: {
        responseBudgetMs: 500,
        cursorPagination: true,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-search-index-request", "Expected a JSON object body.");
  }
  const action = readString(body.action);
  if (action !== "index" && action !== "purge") {
    return problem(400, "invalid-search-index-action", "action must be index or purge.");
  }
  if (!jobSecretAuthorized(request)) {
    return problem(401, "search-index-denied", "Search indexing requires the job trigger secret.");
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  if (action === "purge") {
    const targetType = readString(body.targetType ?? body.target_type);
    const targetId = readString(body.targetId ?? body.target_id);
    const { data, error } = await service.client
      .from("search_documents")
      .update(buildSearchDocumentPurgePatch({ reason: readString(body.reason) }))
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .select("target_type, target_id, deleted_at")
      .single();
    if (error !== null) {
      return problem(400, "search-purge-failed", error.message);
    }
    return NextResponse.json(
      { ok: true, purged: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const documents = Array.isArray(body.documents) ? body.documents : [body.document ?? body];
  const rows = [];
  try {
    for (const document of documents) {
      if (!isRecord(document)) {
        throw new Error("Each search document must be an object.");
      }
      rows.push(
        buildSearchDocumentUpsertRow({
          targetType: readTargetType(document.targetType ?? document.target_type),
          targetId: readString(document.targetId ?? document.target_id),
          title: readString(document.title),
          body: readString(document.body),
          visibility: readVisibility(document.visibility),
          zoneId: readString(document.zoneId ?? document.zone_id) || null,
          metadata: isRecord(document.metadata) ? document.metadata : {},
          sourceUpdatedAt:
            readString(document.sourceUpdatedAt ?? document.source_updated_at) || null,
          embeddingStatus: readEmbeddingStatus(
            document.embeddingStatus ?? document.embedding_status,
          ),
        }),
      );
    }
  } catch (error) {
    return problem(
      400,
      "invalid-search-document",
      error instanceof Error ? error.message : "Search document is invalid.",
    );
  }

  const { data, error } = await service.client
    .from("search_documents")
    .upsert(rows, { onConflict: "target_type,target_id" })
    .select("target_type, target_id, indexed_at, embedding_status");
  if (error !== null) {
    return problem(400, "search-index-failed", error.message);
  }

  return NextResponse.json(
    {
      ok: true,
      indexed: data ?? [],
      embeddingJob: "embedding_generation",
      freshness: "fresh",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function summarize(body: string): string {
  return body.length > 500 ? `${body.slice(0, 497)}...` : body;
}

function readTargetType(value: unknown): SearchTargetType {
  const parsed = parseSearchTargetTypes(value);
  const targetType = parsed[0];
  if (targetType === undefined) {
    throw new Error("Search document target type is invalid.");
  }
  return targetType;
}

function readVisibility(value: unknown): SearchVisibility | undefined {
  const visibility = readString(value);
  return SEARCH_VISIBILITIES.includes(visibility as SearchVisibility)
    ? (visibility as SearchVisibility)
    : undefined;
}

function readEmbeddingStatus(value: unknown) {
  const status = readString(value);
  if (
    status === "pending" ||
    status === "ready" ||
    status === "failed" ||
    status === "not_required"
  ) {
    return status;
  }
  return undefined;
}
