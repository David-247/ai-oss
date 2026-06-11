import { NextResponse } from "next/server";

/**
 * §5.3: every `/api/*` route group is scaffolded as a 501 stub so its owning
 * feature phase can fill in the implementation. Returns RFC 7807-style JSON.
 */
export function notImplemented(group: string): NextResponse {
  return NextResponse.json(
    {
      type: "https://www.ai-oss.net/errors/not-implemented",
      title: "Not Implemented",
      status: 501,
      detail: `The '${group}' API surface is scaffolded but not yet implemented. It is filled in by its owning feature phase.`,
      group,
    },
    {
      status: 501,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
