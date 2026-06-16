import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPublicVoteSummary } from "@ai-oss/discussions";

describe("Phase 08 vote privacy and API boundaries", () => {
  it("keeps vote summaries free of individual user identifiers", () => {
    const summary = buildPublicVoteSummary(
      [
        {
          userId: "user-secret",
          targetType: "comment",
          targetId: "comment-1",
          value: 1,
          isCertified: true,
        },
      ],
      {
        targetType: "comment",
        targetId: "comment-1",
      },
    );

    expect(summary).toMatchObject({
      targetType: "comment",
      targetId: "comment-1",
      upvotes: 1,
      total: 1,
    });
    expect(JSON.stringify(summary)).not.toContain("user-secret");
    expect(Object.keys(summary)).not.toContain("userId");
    expect(Object.keys(summary)).not.toContain("user_id");
  });

  it("asserts the database unique-vote constraint and protected vote columns", () => {
    const root = resolve("..");
    const schema = readFileSync(
      resolve(root, "supabase/migrations/20260612010100_phase01_schema.sql"),
      "utf8",
    );
    const dbPackage = readFileSync(resolve(root, "packages/db/src/index.ts"), "utf8");

    expect(schema).toContain("unique (user_id, target_type, target_id)");
    expect(dbPackage).toContain('votes: [["user_id", "target_type", "target_id"]]');
    expect(dbPackage).toContain('"suspicious_score"');
    expect(dbPackage).toContain('"is_certified"');
  });

  it("exposes the required Phase 08 API route files", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/posts/route.ts",
      "apps/web/src/app/api/posts/[postId]/route.ts",
      "apps/web/src/app/api/comments/route.ts",
      "apps/web/src/app/api/comments/[commentId]/route.ts",
      "apps/web/src/app/api/votes/route.ts",
      "apps/web/src/app/api/save/route.ts",
      "apps/web/src/app/api/follow/route.ts",
      "apps/web/src/app/api/reports/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("documents that vote API responses are aggregates, not per-user vote lists", () => {
    const root = resolve("..");
    const route = readFileSync(resolve(root, "apps/web/src/app/api/votes/route.ts"), "utf8");

    expect(route).toContain("individualVotesExposed: false");
    expect(route).not.toContain("votes: votes");
    expect(route).not.toContain("user_id:");
  });
});
