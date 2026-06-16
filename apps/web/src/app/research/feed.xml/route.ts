import { buildAtomFeed } from "@ai-oss/search";
import { getServiceClientOrProblem } from "@/lib/auth-server";
import { searchOrigin } from "@/lib/search-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = searchOrigin(request);
  const service = getServiceClientOrProblem();
  const entries = [];
  if (service.ok) {
    const papers = await service.client
      .from("papers")
      .select("identifier, title, abstract, updated_at, published_at")
      .eq("status", "published")
      .neq("moderation_status", "removed")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(25);
    for (const paper of papers.data ?? []) {
      entries.push({
        id: `${origin}/research/${paper.identifier}`,
        title: paper.title,
        href: `${origin}/research/${paper.identifier}`,
        updated: paper.updated_at ?? paper.published_at,
        summary: paper.abstract,
      });
    }
  }
  const now = new Date().toISOString();
  return new Response(
    buildAtomFeed({
      title: "AI-OSS.net Research",
      id: `${origin}/research/feed.xml`,
      updated: entries[0]?.updated ?? now,
      entries,
    }),
    {
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
