import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders, evaluateCsrfRequest } from "@ai-oss/security";
import { resolveCanonicalRedirect } from "@/lib/canonical";

// Edge middleware (§4): enforce the apex→www 308 redirect at the edge.
// NOTE: Vercel's domain configuration should ALSO be set so `www` is the
// canonical domain (defense in depth); this middleware guarantees the 308
// behavior in code and keeps it testable.
export function middleware(request: NextRequest): NextResponse {
  const csrf = evaluateCsrfRequest({
    method: request.method,
    url: request.url,
    headers: request.headers,
  });
  if (!csrf.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          type: "https://www.ai-oss.net/errors/csrf-protection-required",
          title: "Request rejected",
          status: 403,
          detail: "Cookie-backed mutations require same-origin request metadata or a CSRF token.",
          reason: csrf.reason,
          requirements: csrf.requirements,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  const redirect = resolveCanonicalRedirect(
    request.headers.get("host"),
    request.url,
  );

  if (redirect) {
    return withSecurityHeaders(NextResponse.redirect(redirect.location, redirect.status));
  }

  return withSecurityHeaders(NextResponse.next());
}

// Run on all paths except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function withSecurityHeaders(response: NextResponse): NextResponse {
  const env = process.env.NODE_ENV === "development" ? "development" : "production";
  const headers = buildSecurityHeaders({
    env,
    reportUri: process.env.SECURITY_CSP_REPORT_URI || null,
  });
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}
