import { NextResponse } from "next/server";
import { problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, readString } from "@/lib/research-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-arxiv-import", "Expected a JSON object body.");
  }

  const arxivId = readString(body.arxivId ?? body.arxiv_id);
  const title = readString(body.title);
  const abstract = readString(body.abstract);
  if (!arxivId || !title || !abstract) {
    return problem(400, "arxiv-metadata-required", "arxivId, title, and abstract are required.");
  }

  return NextResponse.json(
    {
      draft: {
        title,
        abstract,
        authors: Array.isArray(body.authors) ? body.authors : [],
        links: [{ type: "arxiv", url: `https://arxiv.org/abs/${encodeURIComponent(arxivId)}` }],
        tags: ["arxiv-import"],
        modelDataDisclosure: "Imported metadata only; submitter must complete AI/data disclosure.",
        safetyDisclosure:
          "Submitter must complete safety and dual-use disclosure before submission.",
      },
      persisted: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
