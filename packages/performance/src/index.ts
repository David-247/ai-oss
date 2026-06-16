export const PACKAGE_NAME = "@ai-oss/performance" as const;

export const PERFORMANCE_BUDGETS = {
  lcpMs: 2_500,
  inpMs: 200,
  cls: 0.1,
  searchResponseMs: 500,
  chatPerceivedLatencyMs: 500,
  initialJsKb: 170,
} as const;

export const PERFORMANCE_CI_TARGETS = [
  target("/", "home"),
  target("/search", "search"),
  target("/research", "research"),
  target("/z", "zones"),
  target("/legal", "legal"),
] as const;

export type PerformanceBudgetKey = keyof typeof PERFORMANCE_BUDGETS;

export interface BudgetCheckInput {
  metric: PerformanceBudgetKey;
  observed: number;
}

export function evaluateBudget(input: BudgetCheckInput) {
  const threshold = PERFORMANCE_BUDGETS[input.metric];
  return {
    metric: input.metric,
    threshold,
    observed: input.observed,
    passed: input.observed <= threshold,
    margin: Number((threshold - input.observed).toFixed(4)),
  };
}

export interface CursorPayload {
  sortValue: string;
  id: string;
}

export interface CursorWindow {
  limit: number;
  fetchLimit: number;
  cursor: CursorPayload | null;
}

export function encodeCursor(input: CursorPayload): string {
  return `v1.${encodeURIComponent(input.sortValue)}|${encodeURIComponent(input.id)}`;
}

export function decodeCursor(value: string | null | undefined): CursorPayload | null {
  if (!value?.startsWith("v1.")) {
    return null;
  }
  const payload = value.slice(3);
  const separatorIndex = payload.includes("|") ? payload.indexOf("|") : payload.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === payload.length - 1) {
    return null;
  }
  const rawSortValue = payload.slice(0, separatorIndex);
  const rawId = payload.slice(separatorIndex + 1);
  if (!rawSortValue || !rawId) {
    return null;
  }
  return {
    sortValue: decodeURIComponent(rawSortValue),
    id: decodeURIComponent(rawId),
  };
}

export function buildCursorWindow(input: {
  limit?: string | number | null;
  cursor?: string | null;
  defaultLimit?: number;
  maxLimit?: number;
}): CursorWindow {
  const defaultLimit = input.defaultLimit ?? 50;
  const maxLimit = input.maxLimit ?? 100;
  const parsedLimit = Number(input.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(maxLimit, Math.trunc(parsedLimit)))
    : defaultLimit;
  return {
    limit,
    fetchLimit: limit + 1,
    cursor: decodeCursor(input.cursor),
  };
}

export function pageFromRows<TRow>(
  rows: readonly TRow[],
  window: CursorWindow,
  cursorForRow: (row: TRow) => CursorPayload,
) {
  const items = rows.slice(0, window.limit);
  const nextSource = rows.length > window.limit ? items[items.length - 1] : undefined;
  return {
    items,
    page: {
      limit: window.limit,
      nextCursor: nextSource === undefined ? null : encodeCursor(cursorForRow(nextSource)),
      hasMore: rows.length > window.limit,
    },
  };
}

export const CACHE_HEADERS = {
  noStore: "no-store",
  publicShort: "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
  publicFeed: "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
} as const;

export function cacheHeadersForPublicContent(input: {
  personalized?: boolean;
  moderationSensitive?: boolean;
  feed?: boolean;
}) {
  if (input.personalized === true || input.moderationSensitive === true) {
    return { "Cache-Control": CACHE_HEADERS.noStore };
  }
  return { "Cache-Control": input.feed === true ? CACHE_HEADERS.publicFeed : CACHE_HEADERS.publicShort };
}

export type TrustTier = "restricted" | "new" | "normal" | "trusted" | "research_partner" | "admin";

export const COST_LIMITS = {
  uploads: {
    restricted: uploadQuota(50, 25, 100),
    new: uploadQuota(100, 50, 250),
    normal: uploadQuota(250, 100, 1_000),
    trusted: uploadQuota(500, 250, 5_000),
    research_partner: uploadQuota(1_000, 500, 25_000),
    admin: uploadQuota(2_000, 1_000, 100_000),
  },
  voice: {
    maxRoomDurationMinutes: 180,
    warningAtMinutes: 150,
    maxRoomsPerTenMinutes: 3,
    maxJoinsPerMinute: 8,
  },
  chat: {
    maxMessagesPerMinute: 30,
    maxBurstMessages: 10,
    perceivedLatencyMs: PERFORMANCE_BUDGETS.chatPerceivedLatencyMs,
  },
  search: {
    maxQueriesPerMinute: 60,
    maxLimit: 50,
    responseBudgetMs: PERFORMANCE_BUDGETS.searchResponseMs,
  },
  embeddings: {
    maxQueuedPerUserPerDay: 500,
    maxBatchSize: 100,
    deadLetterAfterAttempts: 3,
  },
} as const;

export function evaluateUploadCostControl(input: {
  trustTier: TrustTier;
  sizeBytes: number;
  storageUsedBytes: number;
  uploadedTodayBytes: number;
}) {
  const quota = COST_LIMITS.uploads[input.trustTier];
  const allowed =
    input.sizeBytes <= quota.maxFileBytes &&
    input.storageUsedBytes + input.sizeBytes <= quota.maxStorageBytes &&
    input.uploadedTodayBytes + input.sizeBytes <= quota.dailyUploadBytes;
  return {
    allowed,
    quota,
    reasons: [
      ...(input.sizeBytes > quota.maxFileBytes ? ["file_size_quota_exceeded"] : []),
      ...(input.storageUsedBytes + input.sizeBytes > quota.maxStorageBytes
        ? ["storage_quota_exceeded"]
        : []),
      ...(input.uploadedTodayBytes + input.sizeBytes > quota.dailyUploadBytes
        ? ["daily_upload_quota_exceeded"]
        : []),
    ],
  };
}

export function evaluateVoiceRoomDuration(input: {
  startedAt: string | Date | null | undefined;
  now?: Date;
  maxDurationMinutes?: number;
}) {
  const started = input.startedAt ? new Date(input.startedAt).getTime() : Number.NaN;
  const now = input.now ?? new Date();
  const elapsedMinutes = Number.isFinite(started)
    ? Math.max(0, Math.floor((now.getTime() - started) / 60_000))
    : 0;
  const maxDurationMinutes = input.maxDurationMinutes ?? COST_LIMITS.voice.maxRoomDurationMinutes;
  return {
    allowed: elapsedMinutes <= maxDurationMinutes,
    elapsedMinutes,
    maxDurationMinutes,
    warning: elapsedMinutes >= COST_LIMITS.voice.warningAtMinutes,
  };
}

export function buildCostDashboardSummary(input: {
  storageBytes: number;
  voiceMinutes: number;
  searchQueries: number;
  embeddingJobs: number;
  projectedMonthlyCostCents: number;
  donationFundingCents: number;
}) {
  return {
    storageBytes: input.storageBytes,
    voiceMinutes: input.voiceMinutes,
    searchQueries: input.searchQueries,
    embeddingJobs: input.embeddingJobs,
    projectedMonthlyCostCents: input.projectedMonthlyCostCents,
    donationFundingCents: input.donationFundingCents,
    fundingCoveragePercent:
      input.projectedMonthlyCostCents <= 0
        ? 100
        : Math.min(
            100,
            Math.round((input.donationFundingCents / input.projectedMonthlyCostCents) * 100),
          ),
  };
}

export const HOT_PATH_INDEXES = [
  index("posts_public_feed_phase21_idx", "posts", ["visibility", "status", "moderation_status", "created_at", "id"]),
  index("posts_zone_feed_phase21_idx", "posts", ["zone_id", "visibility", "status", "moderation_status", "created_at", "id"]),
  index("comments_post_cursor_phase21_idx", "comments", ["post_id", "created_at", "id"]),
  index("comments_paper_cursor_phase21_idx", "comments", ["paper_id", "created_at", "id"]),
  index("search_documents_query_phase21_idx", "search_documents", ["target_type", "is_fresh", "indexed_at", "id"]),
  index("reports_queue_phase21_idx", "reports", ["status", "zone_id", "created_at", "id"]),
  index("automod_runs_queue_phase21_idx", "automod_runs", ["status", "zone_id", "created_at", "id"]),
  index("appeals_queue_phase21_idx", "appeals", ["status", "created_at", "id"]),
  index("governance_votes_queue_phase21_idx", "governance_votes", ["zone_id", "status", "created_at", "id"]),
  index("voice_rooms_active_phase21_idx", "voice_rooms", ["is_active", "visibility", "created_at", "id"]),
  index("chat_messages_room_cursor_phase21_idx", "chat_messages", ["room_id", "created_at", "id"]),
  index("files_owner_cost_phase21_idx", "files", ["owner_id", "created_at", "size_bytes"]),
  index("abuse_rate_limit_actor_action_phase21_idx", "abuse_rate_limit_events", ["actor_id", "action", "created_at"]),
] as const;

export const LOAD_CHECKS = [
  loadCheck("public-feed", "/api/posts?limit=50", "p95_under_500ms"),
  loadCheck("search-common-query", "/api/search?q=research&type=paper&limit=20", "p95_under_500ms"),
  loadCheck("moderation-queue", "/api/moderation/queue?limit=50", "p95_under_500ms"),
  loadCheck("chat-room-history", "/api/chat/messages?limit=50", "p95_under_500ms"),
] as const;

function target(path: string, name: string) {
  return { path, name, budgets: PERFORMANCE_BUDGETS };
}

function uploadQuota(maxStorageMb: number, maxFileMb: number, dailyUploadMb: number) {
  return {
    maxStorageBytes: maxStorageMb * 1024 * 1024,
    maxFileBytes: maxFileMb * 1024 * 1024,
    dailyUploadBytes: dailyUploadMb * 1024 * 1024,
  };
}

function index(name: string, table: string, columns: readonly string[]) {
  return { name, table, columns };
}

function loadCheck(name: string, path: string, objective: string) {
  return { name, path, objective };
}
