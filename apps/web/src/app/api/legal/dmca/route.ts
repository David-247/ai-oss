import { legalRequestTypeForDmca, handleLegalIntake } from "@/lib/compliance-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  const requestType = isRecord(body) ? legalRequestTypeForDmca(body) : "dmca_takedown";
  return handleLegalIntake(cloneRequestWithBody(request, body), requestType);
}

function cloneRequestWithBody(request: Request, body: unknown) {
  return new Request(request.url, {
    method: request.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
