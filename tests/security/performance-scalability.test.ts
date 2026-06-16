import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOT_PATH_INDEXES } from "@ai-oss/performance";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Phase 21 performance and scalability wiring", () => {
  it("adds migration indexes for every declared hot path", () => {
    const migration = read(
      "supabase/migrations/20260612012100_phase21_performance_scalability.sql",
    );
    for (const index of HOT_PATH_INDEXES) {
      expect(migration).toContain(index.name);
      expect(migration).toContain(`public.${index.table}`);
    }
    expect(migration).toContain("phase21_comments_counter_sync");
    expect(migration).toContain("phase21_votes_score_sync");
    expect(migration).toContain("comment_count = greatest");
    expect(migration).toContain("certified_score = certified_score + certified_delta");
  });

  it("wires cursor pagination into feed, search, moderation, public paper, and voice hot paths", () => {
    for (const path of [
      "apps/web/src/app/api/posts/route.ts",
      "apps/web/src/app/api/search/route.ts",
      "apps/web/src/app/api/moderation/queue/route.ts",
      "apps/web/src/app/api/public/papers/route.ts",
      "apps/web/src/app/api/voice/rooms/route.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("buildCursorWindow");
      expect(source).toContain("pageFromRows");
      expect(source).toContain("page: page.page");
    }
  });

  it("keeps safe public caching separate from personalized responses", () => {
    expect(read("apps/web/src/app/api/public/papers/route.ts")).toContain(
      "cacheHeadersForPublicContent",
    );
    expect(read("apps/web/src/app/api/posts/route.ts")).toContain("personalized: user.userId");
  });

  it("enforces cost controls for upload and voice admission", () => {
    const upload = read("apps/web/src/app/api/files/upload-url/route.ts");
    const voiceToken = read("apps/web/src/app/api/voice/token/route.ts");
    expect(upload).toContain("evaluateUploadCostControl");
    expect(upload).toContain("upload-cost-quota-exceeded");
    expect(upload).toContain('select("size_bytes")');
    expect(voiceToken).toContain("evaluateVoiceRoomDuration");
    expect(voiceToken).toContain("voice-room-duration-limit");
  });

  it("registers CI performance budget checks", () => {
    const ci = read(".github/workflows/ci.yml");
    const manifest = read(".github/performance-budgets.json");
    expect(ci).toContain("performance-budgets");
    expect(ci).toContain("performance/performance-scalability.test.ts");
    expect(manifest).toContain('"lcpMs": 2500');
    expect(manifest).toContain('"/api/search?q=research&type=paper&limit=20"');
  });

  it("surfaces admin cost-dashboard data and search virtualization", () => {
    expect(read("apps/web/src/lib/admin-server.ts")).toContain("buildCostDashboardSummary");
    expect(read("packages/admin/src/index.ts")).toContain("Cost dashboard");
    const searchClient = read("apps/web/src/app/search/search-page-client.tsx");
    expect(searchClient).toContain("nextCursor");
    expect(searchClient).toContain("contentVisibility");
    expect(searchClient).toContain("Load more");
  });
});
