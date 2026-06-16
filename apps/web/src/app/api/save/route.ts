import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return persistenceMissing("save");
}

export function POST() {
  return persistenceMissing("save");
}

export function DELETE() {
  return persistenceMissing("save");
}

function persistenceMissing(group: string) {
  return NextResponse.json(
    {
      type: "https://www.ai-oss.net/errors/persistence-missing",
      title: "Persistence Missing",
      status: 501,
      detail:
        "The Phase 01 schema does not include saved-item tables yet, so this API is intentionally not writing unsupported state.",
      group,
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
