import { handleHealthGet } from "@/lib/observability-server";

export const runtime = "nodejs";

export function GET() {
  return handleHealthGet();
}
