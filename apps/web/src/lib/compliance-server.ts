import { NextResponse } from "next/server";
import {
  buildLegalRequestRow,
  buildTransparencyEventRow,
  normalizeCookieConsent,
  type LegalRequestType,
} from "@ai-oss/compliance";
import type { SupabaseClient } from "@ai-oss/auth";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { isRecord, readRequestBody, readString } from "@/lib/permissions-server";

export async function handleLegalIntake(request: Request, requestType: LegalRequestType) {
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-legal-request", "Expected a JSON or form legal request body.");
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  let row;
  try {
    row = buildLegalRequestRow({
      requestType,
      requester: body.requester ?? body.name ?? body.full_name,
      requesterEmail: body.requesterEmail ?? body.requester_email ?? body.email,
      targetType: body.targetType ?? body.target_type,
      targetId: body.targetId ?? body.target_id,
      targetUrl: body.targetUrl ?? body.target_url ?? body.url,
      jurisdiction: body.jurisdiction,
      description: body.description ?? body.details,
      statement: body.statement ?? body.good_faith_statement,
      signature: body.signature,
      source: request.headers.get("user-agent") ?? "public_intake",
    });
  } catch (error) {
    return problem(
      400,
      "invalid-legal-request",
      error instanceof Error ? error.message : "Legal request input is invalid.",
    );
  }

  const inserted = await service.client.from("legal_requests").insert(row).select("*").single();
  if (inserted.error !== null) {
    return problem(400, "legal-request-create-failed", inserted.error.message);
  }

  if (row.legal_hold && row.target_type === "paper" && row.target_id !== null) {
    await service.client.from("papers").update({ legal_hold: true }).eq("id", row.target_id);
  }

  await recordTransparencyEvent(service.client, {
    eventType: `legal.${requestType}`,
    subjectType: row.target_type,
    subjectId: row.target_id,
    publicBucket: requestType,
    legalRequestId: inserted.data.id,
    metadata: {
      jurisdiction: row.jurisdiction,
      priority: row.priority,
      childSafetyEscalation: row.child_safety_escalation,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      request: inserted.data,
      receiptRequired: true,
      decisionNotificationRequired: true,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

export async function handleCookieConsent(request: Request) {
  const body = await readRequestBody(request);
  const categories = isRecord(body)
    ? isRecord(body.categories)
      ? body.categories
      : body
    : {};
  const consent = normalizeCookieConsent({
    categories,
    gpcSignal:
      request.headers.get("sec-gpc") === "1" ||
      (isRecord(body) && (body.gpcSignal === true || body.gpc_signal === true)),
  });

  const response = NextResponse.json(
    {
      ok: true,
      consent,
      noBehavioralAdvertising: consent.behavioral_advertising === false,
      doNotSellShare: consent.do_not_sell_share,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set("aioss_cookie_consent", encodeURIComponent(JSON.stringify(consent)), {
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}

export async function recordTransparencyEvent(
  client: SupabaseClient,
  input: {
    eventType: string;
    subjectType?: string | null;
    subjectId?: string | null;
    publicBucket: string;
    legalRequestId?: string | null;
    privacyRequestId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const row = {
    ...buildTransparencyEventRow(input),
    legal_request_id: input.legalRequestId ?? null,
    privacy_request_id: input.privacyRequestId ?? null,
  };
  return client.from("transparency_report_events").insert(row);
}

export function legalRequestTypeForDmca(body: Record<string, unknown>): LegalRequestType {
  const noticeType = readString(body.noticeType ?? body.notice_type).toLowerCase();
  return noticeType === "counter_notice" || noticeType === "counter-notice"
    ? "dmca_counter_notice"
    : "dmca_takedown";
}

export function legalRequestTypeForOnlineSafety(body: Record<string, unknown>): LegalRequestType {
  const category = readString(body.category ?? body.notice_category).toLowerCase();
  if (category === "underage" || category === "underage_report") {
    return "underage_report";
  }
  if (category === "csam" || category === "grooming" || category === "child_safety") {
    return "child_safety_escalation";
  }
  return "osa_illegal_content";
}
