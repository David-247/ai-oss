import { describe, expect, it } from "vitest";
import {
  POST_TYPES,
  aggregateVotes,
  applyVoteChange,
  buildCommentEditPatch,
  buildCommentInsertRow,
  buildCommentTree,
  buildPostInsertRow,
  buildPublicVoteSummary,
  rankContent,
} from "@ai-oss/discussions";

describe("Phase 08 discussions, votes, and ranking", () => {
  it("builds rows for every required post type", () => {
    for (const postType of POST_TYPES) {
      const row = buildPostInsertRow({
        authorId: "user-1",
        zoneId: "zone-1",
        postType,
        title: `${postType} discussion title`,
        body: postType === "link" ? "" : "Markdown body with @alice and a reproducible note.",
        url: postType === "link" ? "https://example.com/paper" : undefined,
        pollOptions: postType === "poll" ? ["Yes", "No"] : undefined,
        tags: ["AI Safety", "AI Safety", " evals! "],
      });

      expect(row.post_type).toBe(postType);
      expect(row.author_id).toBe("user-1");
      expect(row.tags).toEqual(["ai-safety", "evals"]);
      expect(row.status).toBe("published");
    }
  });

  it("retains comment edit history and markdown metadata", () => {
    const comment = buildCommentInsertRow({
      authorId: "user-1",
      postId: "post-1",
      body: ["Here is code for @reviewer.", "", "```ts", "export const ok = true;", "```"].join(
        "\n",
      ),
    });

    expect(comment.markdown).toMatchObject({
      analysis: {
        mentions: ["reviewer"],
        codeBlockCount: 1,
        hasCodeBlocks: true,
      },
    });

    const edit = buildCommentEditPatch({
      previousBody: comment.body,
      previousEditHistory: comment.edit_history,
      newBody: "Updated comment with corrected methodology.",
      editorId: "user-1",
      now: new Date("2026-06-12T00:00:00.000Z"),
    });

    expect(edit.edit_history).toEqual([
      {
        edited_at: "2026-06-12T00:00:00.000Z",
        edited_by: "user-1",
        previous_body: comment.body,
      },
    ]);
  });

  it("builds recursive comment trees", () => {
    const tree = buildCommentTree([
      { id: "root", parent_comment_id: null, body: "root" },
      { id: "child", parent_comment_id: "root", body: "child" },
      { id: "grandchild", parent_comment_id: "child", body: "grandchild" },
    ]);

    expect(tree[0]?.children[0]?.children[0]?.id).toBe("grandchild");
  });

  it("enforces one vote per user target and supports change and removal", () => {
    let votes = applyVoteChange([], {
      userId: "user-1",
      targetType: "post",
      targetId: "post-1",
      value: 1,
    });
    votes = applyVoteChange(votes, {
      userId: "user-1",
      targetType: "post",
      targetId: "post-1",
      value: -1,
    });
    votes = applyVoteChange(votes, {
      userId: "user-2",
      targetType: "post",
      targetId: "post-1",
      value: 1,
      isCertified: true,
    });

    expect(votes).toHaveLength(2);
    expect(
      aggregateVotes(votes, {
        targetType: "post",
        targetId: "post-1",
      }),
    ).toMatchObject({
      upvotes: 1,
      downvotes: 1,
      score: 0,
      certifiedScore: 1,
    });

    votes = applyVoteChange(votes, {
      userId: "user-1",
      targetType: "post",
      targetId: "post-1",
      value: null,
    });

    expect(votes).toHaveLength(1);
    expect(votes[0]?.userId).toBe("user-2");
  });

  it("hides individual vote data and can delay public score reveal", () => {
    const votes = [
      {
        userId: "secret-user",
        targetType: "post" as const,
        targetId: "post-1",
        value: 1 as const,
      },
    ];
    const summary = buildPublicVoteSummary(
      votes,
      {
        targetType: "post",
        targetId: "post-1",
      },
      {
        now: new Date("2026-06-12T00:00:00.000Z"),
        scoreHiddenUntil: "2026-06-13T00:00:00.000Z",
      },
    );

    expect(summary.scoreVisible).toBe(false);
    expect(summary.visibleScore).toBeNull();
    expect(JSON.stringify(summary)).not.toContain("secret-user");
  });

  it("orders all ranking modes and discounts suspicious pending votes", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    const ranked = rankContent(
      [
        {
          id: "brigaded",
          createdAt: "2026-06-12T11:00:00.000Z",
          score: 10,
          certifiedScore: 2,
          suspiciousVoteScore: 8,
          upvotes: 10,
          downvotes: 0,
        },
        {
          id: "certified",
          createdAt: "2026-06-12T10:00:00.000Z",
          score: 4,
          certifiedScore: 4,
          upvotes: 5,
          downvotes: 1,
        },
      ],
      { mode: "top", topWindow: "day", now },
    );

    expect(ranked.map((item) => item.item.id)).toEqual(["certified", "brigaded"]);
    expect(ranked[1]?.rankableScore).toBe(2);

    expect(
      rankContent(
        [
          { id: "old", createdAt: "2026-06-11T00:00:00.000Z", score: 100 },
          { id: "new", createdAt: "2026-06-12T11:00:00.000Z", score: 1 },
        ],
        { mode: "new", now },
      )[0]?.item.id,
    ).toBe("new");
  });
});
