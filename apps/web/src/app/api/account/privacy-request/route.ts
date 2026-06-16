import { NextResponse } from "next/server";
import { buildPrivacyRequestRow } from "@ai-oss/compliance";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { recordTransparencyEvent } from "@/lib/compliance-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-privacy-request", "Expected a JSON object body.");
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  let row;
  try {
    row = buildPrivacyRequestRow({
      userId: auth.user.id,
      requestType: body.requestType ?? body.request_type,
      jurisdiction: body.jurisdiction,
      message: readString(body.message) || readString(body.details),
      gpcSignal: request.headers.get("sec-gpc") === "1" || body.gpcSignal === true,
      doNotSellShare: body.doNotSellShare ?? body.do_not_sell_share,
      limitSensitiveData: body.limitSensitiveData ?? body.limit_sensitive_data,
    });
  } catch (error) {
    return problem(
      400,
      "unsupported-privacy-request",
      error instanceof Error ? error.message : "Privacy request type is unsupported.",
    );
  }

  const { data, error } = await service.client
    .from("privacy_requests")
    .insert(row)
    .select("*")
    .single();

  if (error !== null) {
    return problem(400, "privacy-request-failed", error.message);
  }

  await recordTransparencyEvent(service.client, {
    eventType: `privacy.${row.request_type}`,
    subjectType: "privacy_request",
    subjectId: data.id,
    publicBucket: row.request_type,
    privacyRequestId: data.id,
    metadata: {
      jurisdiction: row.jurisdiction,
      gpcSignal: row.gpc_signal,
      doNotSellShare: row.do_not_sell_share,
    },
  });

  return NextResponse.json(
    { ok: true, request: data },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
