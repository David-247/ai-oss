import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CACHE_HEADERS,
  COST_LIMITS,
  HOT_PATH_INDEXES,
  LOAD_CHECKS,
  PERFORMANCE_BUDGETS,
  PERFORMANCE_CI_TARGETS,
  buildCostDashboardSummary,
  buildCursorWindow,
  cacheHeadersForPublicContent,
  encodeCursor,
  evaluateBudget,
  evaluateUploadCostControl,
  evaluateVoiceRoomDuration,
  pageFromRows,
} from "@ai-oss/performance";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

describe("Phase 21 performance and scalability helpers", () => {
  it("declares launch performance budgets and CI targets", () => {
    expect(PERFORMANCE_BUDGETS).toMatchObject({
      lcpMs: 2500,
      inpMs: 200,
      cls: 0.1,
      searchResponseMs: 500,
      chatPerceivedLatencyMs: 500,
    });
    expect(evaluateBudget({ metric: "lcpMs", observed: 2400 })).toMatchObject({
      passed: true,
      margin: 100,
    });
    expect(evaluateBudget({ metric: "inpMs", observed: 250 })).toMatchObject({
      passed: false,
      margin: -50,
    });
    expect(PERFORMANCE_CI_TARGETS.map((target) => target.path)).toEqual(
      expect.arrayContaining(["/", "/search", "/research", "/z", "/legal"]),
    );
  });

  it("keeps the CI budget manifest aligned with package budgets", () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, ".github/performance-budgets.json"), "utf8"),
    ) as { budgets: typeof PERFORMANCE_BUDGETS; targets: string[]; loadChecks: string[] };
    expect(manifest.budgets).toEqual(PERFORMANCE_BUDGETS);
    expect(manifest.targets).toEqual(PERFORMANCE_CI_TARGETS.map((target) => target.path));
    expect(manifest.loadChecks).toEqual(LOAD_CHECKS.map((check) => check.path));
  });

  it("creates stable cursor windows and page metadata", () => {
    const cursor = encodeCursor({ sortValue: "2026-06-12T00:00:00.000Z", id: "row-1" });
    const window = buildCursorWindow({ limit: "2", cursor });
    expect(window).toMatchObject({
      limit: 2,
      fetchLimit: 3,
      cursor: { sortValue: "2026-06-12T00:00:00.000Z", id: "row-1" },
    });
    const page = pageFromRows(
      [
        { id: "a", created_at: "2026-06-12T03:00:00.000Z" },
        { id: "b", created_at: "2026-06-12T02:00:00.000Z" },
        { id: "c", created_at: "2026-06-12T01:00:00.000Z" },
      ],
      window,
      (row) => ({ sortValue: row.created_at, id: row.id }),
    );
    expect(page.items.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.page.hasMore).toBe(true);
    expect(page.page.nextCursor).toContain("2026-06-12T02");
  });

  it("separates public cache policy from personalized or moderation-sensitive data", () => {
    expect(cacheHeadersForPublicContent({ feed: true })["Cache-Control"]).toBe(
      CACHE_HEADERS.publicFeed,
    );
    expect(cacheHeadersForPublicContent({ personalized: true })["Cache-Control"]).toBe("no-store");
    expect(cacheHeadersForPublicContent({ moderationSensitive: true })["Cache-Control"]).toBe(
      "no-store",
    );
  });

  it("enforces cost controls for upload, voice, search, chat, and embedding budgets", () => {
    const quota = evaluateUploadCostControl({
      trustTier: "new",
      sizeBytes: COST_LIMITS.uploads.new.maxFileBytes + 1,
      storageUsedBytes: 0,
      uploadedTodayBytes: 0,
    });
    expect(quota).toMatchObject({
      allowed: false,
      reasons: ["file_size_quota_exceeded"],
    });
    expect(
      evaluateVoiceRoomDuration({
        startedAt: "2026-06-12T00:00:00.000Z",
        now: new Date("2026-06-12T03:01:00.000Z"),
      }),
    ).toMatchObject({ allowed: false, elapsedMinutes: 181 });
    expect(COST_LIMITS.search.responseBudgetMs).toBe(500);
    expect(COST_LIMITS.chat.perceivedLatencyMs).toBe(500);
    expect(COST_LIMITS.embeddings.maxBatchSize).toBeLessThanOrEqual(100);
  });

  it("declares hot-path indexes and admin cost dashboard math", () => {
    expect(HOT_PATH_INDEXES.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        "posts_public_feed_phase21_idx",
        "search_documents_query_phase21_idx",
        "reports_queue_phase21_idx",
        "voice_rooms_active_phase21_idx",
        "files_owner_cost_phase21_idx",
      ]),
    );
    expect(
      buildCostDashboardSummary({
        storageBytes: 100,
        voiceMinutes: 20,
        searchQueries: 30,
        embeddingJobs: 4,
        projectedMonthlyCostCents: 10_000,
        donationFundingCents: 2_500,
      }),
    ).toMatchObject({ fundingCoveragePercent: 25 });
  });
});
