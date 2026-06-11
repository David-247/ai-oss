# Phase 08 — Posts, Comments, Voting, Feeds & Ranking

**Source sections:** §9 Posts, Comments, Voting, and Feeds (9.1–9.4).

## Objectives

Deliver the Reddit-like discussion core: all post types, threaded Markdown comments, voting with anti-abuse safeguards, and feed ranking — within zones and globally.

## Dependencies
- Phase 07 (zones), Phase 05 (Markdown render), Phase 01 (`posts`, `comments`, `votes`). Vote anomaly/certification deepened in Phase 14; AutoMod hooks in Phase 13.

## In scope

### Post types (§9.1) — MUST support
Text; link; research discussion; question; announcement; poll (where enabled); project/worklog update; reproducibility note; safety notice; meta/mod announcement.

### Comments (§9.2) — MUST support
Threading; Markdown; code blocks; mentions; permalinks; **edits with edit history for moderation**; deletion/anonymization; locking by moderators; collapsing removed content with reason.

### Voting (§9.3) — MUST support
Upvote; downvote; vote removal/change; vote-score hiding during anti-brigading windows where configured; **per-user unique vote constraints**; bot/anomaly detection; vote fuzzing / delayed score reveal where configured; separate votes for posts, comments, papers, reviews, replication reports.
- **Vote data MUST NOT be publicly exposed at individual-user level.**

### Ranking (§9.4) — MUST include
Hot; New; Top by day/week/month/year/all; Active; Controversial; zone-specific ranking; research-specific ranking (Phase 09 consumes).
- Ranking MUST **discount or delay suspicious votes until certified** by anti-abuse checks (Phase 14).

## Out of scope (deferred)
- Research-paper voting UI lives on paper pages (Phase 09) but reuses this vote engine. Full anti-brigading detection/mitigation → Phase 14. AutoMod content rules → Phase 13. Search indexing of posts/comments → Phase 12.

## Data model
`posts`, `comments` (post- or paper-linked, threaded via `parent_comment_id`), `votes` (`unique(user_id,target_type,target_id)`), materialized `score`/`comment_count` counters.

## Routes / APIs
- Pages: `/z/[zoneSlug]/new`, `/z/[zoneSlug]/comments/[postId]`; global feed at `/`.
- APIs: `/api/posts`, `/api/posts/[postId]`, `/api/comments`, `/api/comments/[commentId]`, `/api/votes`, `/api/save`, `/api/follow`, `/api/reports` (report entry → Phase 13).

## Work items
1. Implement post creation for all §9.1 types (incl. polls where enabled) with zone permission checks.
2. Implement threaded comments with Markdown/code/mentions/permalinks; edit history retained for moderation; deletion/anonymization; mod lock; removed-content collapse with reason.
3. Implement voting: upvote/downvote/change/remove; enforce per-user uniqueness; separate target types; score hiding/fuzzing/delayed reveal config; never expose per-user vote data.
4. Implement ranking algorithms (hot/new/top windows/active/controversial) + zone-specific feeds + global feed.
5. Integrate suspicious-vote discounting/delay pending certification (hooks to Phase 14).
6. Wire save + follow.

## Acceptance criteria
- All post types creatable; comments thread correctly with retained edit history.
- Voting enforces uniqueness; vote changes/removal work; individual vote data is never exposed.
- All ranking modes return correct ordering; suspicious votes are discounted/delayed until certified.
- Score hiding/fuzzing works where configured.

## Tests (§27.1, §27.2, §27.3)
- Unit: vote uniqueness; ranking functions.
- Integration: post/comment/vote.
- E2E: create post; comment and vote.

## Requirement traceability
REQ-CORE-006; §9; agent rule §29 (#10).
