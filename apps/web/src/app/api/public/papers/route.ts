import { NextResponse } from "next/server";
import { buildPublicPaperMetadata } from "@ai-oss/search";
import {
  buildCursorWindow,
  cacheHeadersForPublicContent,
  pageFromRows,
} from "@ai-oss/performance";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const url = new URL(request.url);
  const pageWindow = buildCursorWindow({
    limit: url.searchParams.get("limit"),
    cursor: url.searchParams.get("cursor"),
    defaultLimit: 50,
    maxLimit: 100,
  });
  let query = service.client
    .from("papers")
    .select(
      "id, identifier, title, abstract, status, license, tags, categories, published_at, updated_at",
    )
    .eq("status", "published")
    .neq("moderation_status", "removed")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageWindow.fetchLimit);
  if (pageWindow.cursor !== null) {
    query = query.lt("published_at", pageWindow.cursor.sortValue);
  }
  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "public-papers-read-failed", error.message);
  }

  const page = pageFromRows(data ?? [], pageWindow, (paper) => ({
    sortValue: String(paper.published_at ?? paper.updated_at ?? ""),
    id: String(paper.id ?? ""),
  }));
  return NextResponse.json(
    {
      papers: page.items.map((paper) => buildPublicPaperMetadata({ paper })),
      page: page.page,
    },
    { headers: cacheHeadersForPublicContent({ feed: true }) },
  );
}
