import { handleCookieConsent } from "@/lib/compliance-server";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handleCookieConsent(request);
}
