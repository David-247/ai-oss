import { NextResponse } from "next/server";
import {
  AUTOMOD_ACTION_TYPES,
  AUTOMOD_CONDITION_KEYS,
  MODERATION_RULE_LAYERS,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
} from "@ai-oss/moderation";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      surface: "moderation",
      routes: [
        "/api/reports",
        "/api/moderation/queue",
        "/api/moderation/actions",
        "/api/moderation/appeals",
        "/api/moderation/automod/test",
        "/api/moderation/automod/rules",
      ],
      ruleLayers: MODERATION_RULE_LAYERS,
      conditionKeys: AUTOMOD_CONDITION_KEYS,
      actionTypes: AUTOMOD_ACTION_TYPES,
      reportTargets: REPORT_TARGET_TYPES,
      reportReasons: REPORT_REASONS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
