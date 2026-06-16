import { NextResponse } from "next/server";
import { dispatchJobRequest, listJobs } from "@/lib/jobs";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      group: "workflows",
      jobs: listJobs().filter((job) => job.runtime === "workflow" || job.runtime === "queue"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  return dispatchJobRequest(request, "workflow");
}
