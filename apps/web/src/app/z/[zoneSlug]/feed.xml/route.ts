import { buildAtomFeed } from "@ai-oss/search";
import { getServiceClientOrProblem } from "@/lib/auth-server";
import { searchOrigin } from "@/lib/search-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ zoneSlug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { zoneSlug } = await context.params;
  const origin = searchOrigin(request);
  const service = getServiceClientOrProblem();
  const entries = [];
  if (service.ok) {
    const zone = await service.client
      .from("zones")
      .select("id, slug")
      .eq("slug", zoneSlug)
      .eq("visibility", "public")
      .eq("status", "active")
      .maybeSingle();
    if (zone.data !== null) {
      const posts = await service.client
        .from("posts")
        .select("id, title, body, updated_at, created_at")
        .eq("zone_id", zone.data.id)
        .eq("visibility", "public")
        .eq("status", "published")
        .neq("moderation_status", "removed")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(25);
      for (const post of posts.data ?? []) {
        entries.push({
          id: `${origin}/z/${zoneSlug}/posts/${post.id}`,
          title: post.title,
          href: `${origin}/z/${zoneSlug}/posts/${post.id}`,
          updated: post.updated_at ?? post.created_at,
          summary: post.body,
        });
      }
    }
  }
  const now = new Date().toISOString();
  return new Response(
    buildAtomFeed({
      title: `AI-OSS.net Zone ${zoneSlug}`,
      id: `${origin}/z/${zoneSlug}/feed.xml`,
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
