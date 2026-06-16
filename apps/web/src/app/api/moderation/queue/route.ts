import { NextResponse } from "next/server";
import {
  buildQueueItemFromAppeal,
  buildQueueItemFromAutomodRun,
  buildQueueItemFromReport,
  parseSeverity,
  prioritizeModerationQueue,
  type ModerationQueueItem,
} from "@ai-oss/moderation";
import { buildCursorWindow, pageFromRows, type CursorPayload } from "@ai-oss/performance";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { readString } from "@/lib/discussions-server";
import {
  moderationReadableZoneFilter,
  requireModerationSession,
  requireReadModeration,
} from "@/lib/moderation-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const zoneId = readString(url.searchParams.get("zoneId")) || null;
  const access = requireReadModeration(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }
  const source = readString(url.searchParams.get("source"));
  const status = readString(url.searchParams.get("status"));
  const severity = readString(url.searchParams.get("severity"));
  const pageWindow = buildCursorWindow({
    limit: url.searchParams.get("limit"),
    cursor: url.searchParams.get("cursor"),
    defaultLimit: 50,
    maxLimit: 100,
  });
  const filter = moderationReadableZoneFilter(session.viewer, zoneId);

  const items: ModerationQueueItem[] = [];
  if (!source || source === "report") {
    const reports = await readReports(request, service.client, filter, status, pageWindow.fetchLimit, pageWindow.cursor);
    if (!reports.ok) {
      return reports.response;
    }
    items.push(...reports.items);
  }
  if (!source || source === "automod_run") {
    const runs = await readAutomodRuns(service.client, filter, pageWindow.fetchLimit, pageWindow.cursor);
    if (!runs.ok) {
      return runs.response;
    }
    items.push(...runs.items);
  }
  if (!source || source === "appeal") {
    const appeals = await readAppeals(service.client, filter, pageWindow.fetchLimit, pageWindow.cursor);
    if (!appeals.ok) {
      return appeals.response;
    }
    items.push(...appeals.items);
  }

  const filtered = severity
    ? items.filter((item) => item.severity === parseSeverity(severity))
    : items;
  const page = pageFromRows(prioritizeModerationQueue(filtered), pageWindow, (item) => ({
    sortValue: item.createdAt,
    id: item.id,
  }));
  return NextResponse.json(
    {
      queue: page.items,
      filters: {
        source: source || null,
        status: status || null,
        severity: severity || null,
        zoneId,
      },
      realtime: {
        transport: "supabase_realtime",
        channels: zoneId ? [`moderation:zone:${zoneId}`] : ["moderation:global"],
      },
      page: page.page,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function readReports(
  request: Request,
  client: Parameters<typeof requireModerationSession>[1],
  filter: { global: boolean; zoneIds: string[] },
  status: string,
  limit: number,
  cursor: CursorPayload | null,
) {
  let query = client
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor !== null) {
    query = query.lt("created_at", cursor.sortValue);
  }
  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["open", "triaged"]);
  }
  if (filter.zoneIds.length > 0) {
    query =
      filter.zoneIds.length === 1
        ? query.eq("zone_id", filter.zoneIds[0])
        : query.in("zone_id", filter.zoneIds);
  } else if (!filter.global) {
    return {
      ok: false as const,
      response: problem(403, "moderation-queue-denied", "No readable moderation zones."),
    };
  }

  const { data, error } = await query;
  if (error !== null) {
    return { ok: false as const, response: problem(400, "reports-queue-failed", error.message) };
  }
  return {
    ok: true as const,
    items: (data ?? []).map((report) => buildQueueItemFromReport(report)),
    request,
  };
}

async function readAutomodRuns(
  client: Parameters<typeof requireModerationSession>[1],
  filter: { global: boolean; zoneIds: string[] },
  limit: number,
  cursor: CursorPayload | null,
) {
  let query = client
    .from("automod_runs")
    .select("*")
    .in("status", ["matched", "errored"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor !== null) {
    query = query.lt("created_at", cursor.sortValue);
  }
  if (filter.zoneIds.length > 0) {
    query =
      filter.zoneIds.length === 1
        ? query.eq("zone_id", filter.zoneIds[0])
        : query.in("zone_id", filter.zoneIds);
  } else if (!filter.global) {
    return { ok: true as const, items: [] };
  }

  const { data, error } = await query;
  if (error !== null) {
    return { ok: false as const, response: problem(400, "automod-queue-failed", error.message) };
  }
  return { ok: true as const, items: (data ?? []).map((run) => buildQueueItemFromAutomodRun(run)) };
}

async function readAppeals(
  client: Parameters<typeof requireModerationSession>[1],
  filter: { global: boolean; zoneIds: string[] },
  limit: number,
  cursor: CursorPayload | null,
) {
  let query = client
    .from("appeals")
    .select("*, moderation_actions(*)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor !== null) {
    query = query.lt("created_at", cursor.sortValue);
  }
  const { data, error } = await query;
  if (error !== null) {
    return { ok: false as const, response: problem(400, "appeals-queue-failed", error.message) };
  }
  const rows = (data ?? []).filter((appeal) => {
    if (filter.global) {
      return true;
    }
    const action = appeal.moderation_actions;
    const zoneId = readString(
      Array.isArray(action)
        ? action[0]?.zone_id
        : action && "zone_id" in action
          ? action.zone_id
          : null,
    );
    return zoneId && filter.zoneIds.includes(zoneId);
  });
  return { ok: true as const, items: rows.map((appeal) => buildQueueItemFromAppeal(appeal)) };
}
