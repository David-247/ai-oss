import { buildSitemapXml } from "@ai-oss/search";
import { getServiceClientOrProblem } from "@/lib/auth-server";
import { searchOrigin } from "@/lib/search-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = searchOrigin(request);
  const entries: { loc: string; lastmod?: string | null }[] = [
    { loc: `${origin}/` },
    { loc: `${origin}/research` },
    { loc: `${origin}/search` },
    { loc: `${origin}/z` },
    { loc: `${origin}/legal` },
  ];
  const service = getServiceClientOrProblem();
  if (service.ok) {
    const papers = await service.client
      .from("papers")
      .select("identifier, updated_at")
      .eq("status", "published")
      .neq("moderation_status", "removed")
      .is("deleted_at", null)
      .limit(500);
    for (const paper of papers.data ?? []) {
      entries.push({
        loc: `${origin}/research/${paper.identifier}`,
        lastmod: paper.updated_at,
      });
    }
  }
  return new Response(buildSitemapXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
