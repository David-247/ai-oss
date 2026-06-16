import { NextResponse } from "next/server";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET() {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const { data, error } = await service.client
    .from("papers")
    .select("id, identifier, title, abstract, categories, tags, status, safety_status, created_at")
    .in("status", ["published", "withdrawn", "superseded", "retracted", "redacted"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error !== null) {
    return problem(400, "research-read-failed", error.message);
  }

  return NextResponse.json(
    {
      papers: data ?? [],
      routes: {
        papers: "/api/research/papers",
        importArxivMetadata: "/api/research/import/arxiv-metadata-optional",
      },
      label: "Not peer reviewed / not platform endorsed",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
