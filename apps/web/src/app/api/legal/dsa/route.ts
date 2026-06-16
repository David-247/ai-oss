import { handleLegalIntake } from "@/lib/compliance-server";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handleLegalIntake(request, "dsa_notice");
}
