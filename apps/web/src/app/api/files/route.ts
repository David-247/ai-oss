import { NextResponse } from "next/server";
import {
  FILE_TYPE_POLICIES,
  PAPER_FILE_KINDS,
  QUARANTINE_BUCKET,
  UPLOAD_CONTEXTS,
} from "@ai-oss/files";
import { problem } from "@/lib/auth-server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      uploadContexts: UPLOAD_CONTEXTS,
      paperFileKinds: PAPER_FILE_KINDS,
      quarantineBucket: QUARANTINE_BUCKET,
      fileTypes: FILE_TYPE_POLICIES,
      routes: {
        uploadUrl: "/api/files/upload-url",
        complete: "/api/files/complete",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function POST() {
  return problem(
    405,
    "files-method-not-allowed",
    "Use /api/files/upload-url or /api/files/complete.",
  );
}

export function PUT() {
  return POST();
}

export function PATCH() {
  return POST();
}

export function DELETE() {
  return POST();
}
