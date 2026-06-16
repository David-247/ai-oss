import { searchOrigin } from "@/lib/search-server";

export function GET(request: Request) {
  const origin = searchOrigin(request);
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /account",
      "Disallow: /api/chat",
      "Disallow: /api/voice",
      "Disallow: /api/admin",
      `Sitemap: ${origin}/sitemap.xml`,
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
