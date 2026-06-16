import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 09 research publishing safety boundaries", () => {
  it("exposes the required research API route files", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/research/route.ts",
      "apps/web/src/app/api/research/papers/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/versions/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/files/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/reviews/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/replications/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/withdraw/route.ts",
      "apps/web/src/app/api/research/import/arxiv-metadata-optional/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("keeps paper versions append-only and uniquely versioned", () => {
    const root = resolve("..");
    const schema = readFileSync(
      resolve(root, "supabase/migrations/20260612010100_phase01_schema.sql"),
      "utf8",
    );
    const versionRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/research/papers/[paperId]/versions/route.ts"),
      "utf8",
    );
    const paperRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/research/papers/[paperId]/route.ts"),
      "utf8",
    );

    expect(schema).toContain("unique (paper_id, version_number)");
    expect(versionRoute).toContain('from("paper_versions")');
    expect(versionRoute).toContain(".insert(versionRow)");
    expect(versionRoute).not.toContain('from("paper_versions").upsert');
    expect(paperRoute).toContain("paper-delete-prohibited");
  });

  it("requires author verification for author response reviews", () => {
    const root = resolve("..");
    const route = readFileSync(
      resolve(root, "apps/web/src/app/api/research/papers/[paperId]/reviews/route.ts"),
      "utf8",
    );

    expect(route).toContain("author-response-denied");
    expect(route).toContain("isVerifiedAuthor");
    expect(route).toContain('reviewType === "author_response"');
  });

  it("preserves the no-endorsement label and automated safety gate", () => {
    const root = resolve("..");
    const collectionRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/research/papers/route.ts"),
      "utf8",
    );
    const paperRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/research/papers/[paperId]/route.ts"),
      "utf8",
    );

    expect(collectionRoute).toContain("Not peer reviewed / not platform endorsed");
    expect(paperRoute).toContain("evaluatePublishingChecks");
    expect(paperRoute).toContain("automatedChecks");
  });
});
