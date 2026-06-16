import {
  handleObservabilityGet,
  handleObservabilityPost,
} from "@/lib/observability-server";

export const runtime = "nodejs";

export function GET() {
  return handleObservabilityGet();
}

export function POST(request: Request) {
  return handleObservabilityPost(request);
}
