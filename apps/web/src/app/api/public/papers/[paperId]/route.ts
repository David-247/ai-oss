import { NextResponse } from "next/server";
import { buildPublicPaperMetadata } from "@ai-oss/search";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ paperId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { paperId } = await context.params;
  const paper = await service.client
    .from("papers")
    .select("*")
    .or(`id.eq.${paperId},identifier.eq.${paperId}`)
    .eq("status", "published")
    .neq("moderation_status", "removed")
    .is("deleted_at", null)
    .maybeSingle();
  if (paper.error !== null) {
    return problem(400, "public-paper-read-failed", paper.error.message);
  }
  if (paper.data === null) {
    return problem(404, "public-paper-not-found", "Public paper does not exist.");
  }

  const [versions, authors, links] = await Promise.all([
    service.client
      .from("paper_versions")
      .select("version_number, title, abstract, created_at, metadata_snapshot")
      .eq("paper_id", paper.data.id)
      .order("version_number", { ascending: false }),
    service.client
      .from("paper_authors")
      .select("author_name, author_slug, affiliation, orcid, author_order")
      .eq("paper_id", paper.data.id)
      .order("author_order", { ascending: true }),
    service.client
      .from("paper_links")
      .select("link_type, url, label")
      .eq("paper_id", paper.data.id),
  ]);

  return NextResponse.json(
    {
      paper: buildPublicPaperMetadata({
        paper: paper.data,
        versions: versions.data ?? [],
        authors: authors.data ?? [],
        links: links.data ?? [],
      }),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
