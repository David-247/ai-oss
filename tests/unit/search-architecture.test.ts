import { describe, expect, it } from "vitest";
import {
  SEARCH_TARGET_TYPES,
  buildAtomFeed,
  buildLlmsTxt,
  buildSearchDocumentPurgePatch,
  buildSearchDocumentUpsertRow,
  buildSearchFacets,
  buildSuggestions,
  buildSitemapXml,
  canReadSearchDocument,
  normalizeSearchQuery,
  parseSearchTargetTypes,
  rankSearchResult,
  type SearchResult,
  type SearchViewer,
} from "@ai-oss/search";

describe("Phase 12 search architecture", () => {
  it("builds searchable documents for every required surface", () => {
    for (const targetType of SEARCH_TARGET_TYPES) {
      const row = buildSearchDocumentUpsertRow({
        targetType,
        targetId: "00000000-0000-4000-8000-000000000001",
        title: `${targetType} title`,
        body: "Open model evaluation and replication notes",
        visibility: targetType === "chat_message" ? "private" : "public",
        metadata: { tags: ["evals"], categories: ["benchmarks"] },
        now: new Date("2026-06-12T00:00:00.000Z"),
      });

      expect(row.target_type).toBe(targetType);
      expect(row.is_fresh).toBe(true);
      expect(row.indexed_at).toBe("2026-06-12T00:00:00.000Z");
      expect(row.deleted_at).toBeNull();
    }
  });

  it("normalizes queries and target filters", () => {
    expect(normalizeSearchQuery("  model\n\n evals   ")).toBe("model evals");
    expect(parseSearchTargetTypes("paper,post,nope")).toEqual(["paper", "post"]);
  });

  it("enforces viewer visibility without leaking private or moderator records", () => {
    const viewer: SearchViewer = {
      userId: "user-1",
      authenticated: true,
      readableZoneIds: ["zone-1"],
      moderatorZoneIds: ["zone-2"],
      canReadAdmin: false,
    };
    const base: SearchResult = {
      target_type: "post",
      target_id: "post-1",
      visibility: "zone",
      zone_id: "zone-1",
      title: "Visible",
      body: "Visible",
    };

    expect(canReadSearchDocument(base, viewer)).toBe(true);
    expect(canReadSearchDocument({ ...base, zone_id: "zone-3" }, viewer)).toBe(false);
    expect(
      canReadSearchDocument({ ...base, visibility: "moderator", zone_id: "zone-2" }, viewer),
    ).toBe(true);
    expect(canReadSearchDocument({ ...base, visibility: "admin" }, viewer)).toBe(false);
    expect(
      canReadSearchDocument(
        { ...base, visibility: "private", metadata: { owner_id: "user-1" } },
        viewer,
      ),
    ).toBe(true);
  });

  it("ranks, facets, suggests, and purges search documents", () => {
    const rows: SearchResult[] = [
      {
        target_type: "paper",
        target_id: "paper-1",
        visibility: "public",
        title: "Sparse autoencoder evals",
        body: "Evaluation harness for sparse autoencoders",
        metadata: { tags: ["evals"], categories: ["interpretability"], license: "MIT" },
        indexed_at: "2026-06-12T00:00:00.000Z",
      },
      {
        target_type: "post",
        target_id: "post-1",
        visibility: "public",
        title: "Release notes",
        body: "Forum announcement",
        metadata: { tags: ["release"] },
      },
    ];

    expect(rankSearchResult({ row: rows[0]!, query: "sparse evals" })).toBeGreaterThan(
      rankSearchResult({ row: rows[1]!, query: "sparse evals" }),
    );
    expect(buildSearchFacets(rows).targetTypes).toContainEqual({ value: "paper", count: 1 });
    expect(buildSuggestions(rows, "eval")).toContainEqual({
      label: "evals",
      targetType: "paper",
      weight: 2,
    });
    expect(
      buildSearchDocumentPurgePatch({ now: new Date("2026-06-12T00:00:00.000Z") }),
    ).toMatchObject({
      deleted_at: "2026-06-12T00:00:00.000Z",
      is_fresh: false,
    });
  });

  it("builds SEO and agent-readable assets", () => {
    expect(buildSitemapXml([{ loc: "https://www.ai-oss.net/research" }])).toContain("<urlset");
    expect(
      buildAtomFeed({
        title: "Research",
        id: "https://www.ai-oss.net/research/feed.xml",
        updated: "2026-06-12T00:00:00.000Z",
        entries: [],
      }),
    ).toContain("<feed");
    expect(buildLlmsTxt("https://www.ai-oss.net")).toContain("/api/public/papers");
  });
});
