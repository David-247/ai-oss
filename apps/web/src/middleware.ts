import { NextResponse, type NextRequest } from "next/server";
import { resolveCanonicalRedirect } from "@/lib/canonical";

// Edge middleware (§4): enforce the apex→www 308 redirect at the edge.
// NOTE: Vercel's domain configuration should ALSO be set so `www` is the
// canonical domain (defense in depth); this middleware guarantees the 308
// behavior in code and keeps it testable.
export function middleware(request: NextRequest): NextResponse {
  const redirect = resolveCanonicalRedirect(
    request.headers.get("host"),
    request.url,
  );

  if (redirect) {
    return NextResponse.redirect(redirect.location, redirect.status);
  }

  return NextResponse.next();
}

// Run on all paths except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
