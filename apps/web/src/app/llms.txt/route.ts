import { buildLlmsTxt } from "@ai-oss/search";
import { searchOrigin } from "@/lib/search-server";

export function GET(request: Request) {
  return new Response(buildLlmsTxt(searchOrigin(request)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
