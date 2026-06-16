import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 12 search privacy and SEO boundaries", () => {
  it("exposes search, suggest, public paper, and crawler asset routes", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/search/route.ts",
      "apps/web/src/app/api/search/suggest/route.ts",
      "apps/web/src/app/api/public/papers/route.ts",
      "apps/web/src/app/api/public/papers/[paperId]/route.ts",
      "apps/web/src/app/sitemap.xml/route.ts",
      "apps/web/src/app/robots.txt/route.ts",
      "apps/web/src/app/llms.txt/route.ts",
      "apps/web/src/app/research/feed.xml/route.ts",
      "apps/web/src/app/z/[zoneSlug]/feed.xml/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("filters results through viewer visibility before returning search responses", () => {
    const root = resolve("..");
    const route = readFileSync(resolve(root, "apps/web/src/app/api/search/route.ts"), "utf8");
    const suggest = readFileSync(
      resolve(root, "apps/web/src/app/api/search/suggest/route.ts"),
      "utf8",
    );
    const helper = readFileSync(resolve(root, "apps/web/src/lib/search-server.ts"), "utf8");

    expect(route).toContain("canReadSearchDocument");
    expect(route).toContain("loadSearchViewer");
    expect(suggest).toContain("canReadSearchDocument");
    expect(helper).toContain("readableZoneIds");
    expect(helper).toContain("moderatorZoneIds");
    expect(helper).toContain('scope: "search.read"');
  });

  it("keeps private chat and voice APIs out of crawler assets", () => {
    const root = resolve("..");
    const robots = readFileSync(resolve(root, "apps/web/src/app/robots.txt/route.ts"), "utf8");
    const llms = readFileSync(resolve(root, "packages/search/src/index.ts"), "utf8");

    expect(robots).toContain("Disallow: /api/chat");
    expect(robots).toContain("Disallow: /api/voice");
    expect(llms).toContain("Private zones, private chat, quarantined content");
  });

  it("requires the job trigger secret for indexing writes", () => {
    const root = resolve("..");
    const route = readFileSync(resolve(root, "apps/web/src/app/api/search/route.ts"), "utf8");
    const server = readFileSync(resolve(root, "apps/web/src/lib/search-server.ts"), "utf8");

    expect(route).toContain("search-index-denied");
    expect(route).toContain("buildSearchDocumentUpsertRow");
    expect(route).toContain("buildSearchDocumentPurgePatch");
    expect(server).toContain("JOB_TRIGGER_SECRET");
  });

  it("records freshness and embedding status in the Phase 12 migration", () => {
    const root = resolve("..");
    const migration = readFileSync(
      resolve(root, "supabase/migrations/20260612011200_phase12_search_architecture.sql"),
      "utf8",
    );

    expect(migration).toContain("embedding_status");
    expect(migration).toContain("is_fresh");
    expect(migration).toContain("search_documents_type_visibility_idx");
  });
});
