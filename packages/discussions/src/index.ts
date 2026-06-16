export const PACKAGE_NAME = "@ai-oss/discussions" as const;

export const POST_TYPES = [
  "text",
  "link",
  "research_discussion",
  "question",
  "announcement",
  "poll",
  "project_update",
  "reproducibility_note",
  "safety_notice",
  "meta",
] as const;

export type PostType = (typeof POST_TYPES)[number];

export const POST_VISIBILITIES = ["public", "zone", "private"] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

export const VOTE_TARGET_TYPES = [
  "post",
  "comment",
  "paper",
  "paper_review",
  "replication_report",
] as const;

export type VoteTargetType = (typeof VOTE_TARGET_TYPES)[number];

export const VOTE_VALUES = [-1, 1] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export const RANKING_MODES = ["hot", "new", "top", "active", "controversial"] as const;
export type RankingMode = (typeof RANKING_MODES)[number];

export const TOP_WINDOWS = ["day", "week", "month", "year", "all"] as const;
export type TopWindow = (typeof TOP_WINDOWS)[number];

export interface MarkdownAnalysis {
  sourceFormat: "markdown";
  mentions: string[];
  codeBlockCount: number;
  hasCodeBlocks: boolean;
}

export interface PostDraftInput {
  authorId: string;
  zoneId?: string | null;
  postType?: PostType;
  title: string;
  body?: string | null;
  url?: string | null;
  tags?: readonly string[];
  visibility?: PostVisibility;
  flairId?: string | null;
  pollOptions?: readonly string[];
  voteVisibilityWindowHours?: number;
  now?: Date;
}

export interface PostInsertRow {
  zone_id: string | null;
  author_id: string;
  post_type: PostType;
  title: string;
  url: string | null;
  body: string | null;
  markdown: Record<string, unknown>;
  flair_id: string | null;
  tags: string[];
  visibility: PostVisibility;
  status: "published";
  moderation_status: "clear";
  is_locked: false;
  score: 0;
  certified_score: 0;
  comment_count: 0;
  vote_visibility_until: string | null;
}

export interface CommentDraftInput {
  authorId: string;
  postId?: string | null;
  paperId?: string | null;
  paperVersionId?: string | null;
  parentCommentId?: string | null;
  body: string;
}

export interface CommentInsertRow {
  post_id: string | null;
  paper_id: string | null;
  paper_version_id: string | null;
  parent_comment_id: string | null;
  author_id: string;
  body: string;
  markdown: Record<string, unknown>;
  edit_history: [];
  status: "published";
  moderation_status: "clear";
  is_locked: false;
  score: 0;
  certified_score: 0;
}

export interface CommentEditHistoryEntry {
  edited_at: string;
  edited_by: string;
  previous_body: string;
  reason?: string;
}

export interface VoteState {
  userId: string;
  targetType: VoteTargetType;
  targetId: string;
  value: VoteValue;
  isCertified?: boolean;
  suspiciousScore?: number;
}

export interface VoteAggregate {
  targetType: VoteTargetType;
  targetId: string;
  upvotes: number;
  downvotes: number;
  total: number;
  score: number;
  certifiedScore: number;
  pendingScore: number;
  suspiciousPendingScore: number;
  rankableScore: number;
}

export interface PublicVoteSummary extends VoteAggregate {
  scoreVisible: boolean;
  visibleScore: number | null;
  scoreHiddenUntil: string | null;
}

export interface RankableContentItem {
  id: string;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
  zoneId?: string | null;
  paperId?: string | null;
  score: number;
  certifiedScore?: number;
  suspiciousVoteScore?: number;
  commentCount?: number;
  upvotes?: number;
  downvotes?: number;
}

export interface RankedContentItem<TItem extends RankableContentItem = RankableContentItem> {
  item: TItem;
  rankScore: number;
  rankableScore: number;
}

const BODY_REQUIRED_POST_TYPES = new Set<PostType>([
  "text",
  "research_discussion",
  "question",
  "announcement",
  "poll",
  "project_update",
  "reproducibility_note",
  "safety_notice",
  "meta",
]);

const ONE_HOUR_MS = 60 * 60 * 1000;

export function parsePostType(value: unknown): PostType {
  return POST_TYPES.includes(value as PostType) ? (value as PostType) : "text";
}

export function parsePostVisibility(value: unknown): PostVisibility {
  return POST_VISIBILITIES.includes(value as PostVisibility) ? (value as PostVisibility) : "public";
}

export function parseVoteTargetType(value: unknown): VoteTargetType | null {
  if (VOTE_TARGET_TYPES.includes(value as VoteTargetType)) {
    return value as VoteTargetType;
  }
  if (value === "review") {
    return "paper_review";
  }
  if (value === "replication") {
    return "replication_report";
  }
  return null;
}

export function parseVoteValue(value: unknown): VoteValue | null {
  if (value === 1 || value === "1" || value === "up" || value === "upvote") {
    return 1;
  }
  if (value === -1 || value === "-1" || value === "down" || value === "downvote") {
    return -1;
  }
  return null;
}

export function parseRankingMode(value: unknown): RankingMode {
  return RANKING_MODES.includes(value as RankingMode) ? (value as RankingMode) : "hot";
}

export function parseTopWindow(value: unknown): TopWindow {
  return TOP_WINDOWS.includes(value as TopWindow) ? (value as TopWindow) : "all";
}

export function analyzeMarkdown(source: string): MarkdownAnalysis {
  const codeBlockCount = countFenceBlocks(source);
  const withoutCode = source.replace(/```[\s\S]*?```/g, " ");
  const mentions = Array.from(withoutCode.matchAll(/(^|[^\w])@([a-zA-Z0-9_][a-zA-Z0-9_-]{1,38})/g))
    .map((match) => match[2])
    .filter((mention): mention is string => typeof mention === "string")
    .map((mention) => mention.toLowerCase());

  return {
    sourceFormat: "markdown",
    mentions: Array.from(new Set(mentions)).slice(0, 50),
    codeBlockCount,
    hasCodeBlocks: codeBlockCount > 0,
  };
}

export function sanitizeTags(tags: readonly string[] = []): string[] {
  const normalized = tags
    .map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 32),
    )
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(normalized)).slice(0, 12);
}

export function evaluatePostDraft(input: PostDraftInput): {
  allowed: boolean;
  reasons: string[];
  postType: PostType;
  title: string;
  body: string;
  url: string | null;
  tags: string[];
  pollOptions: string[];
  visibility: PostVisibility;
} {
  const postType = parsePostType(input.postType);
  const title = normalizeWhitespace(input.title).slice(0, 240);
  const body = normalizeBody(input.body);
  const tags = sanitizeTags(input.tags);
  const visibility = parsePostVisibility(input.visibility);
  const pollOptions = normalizePollOptions(input.pollOptions);
  const reasons: string[] = [];
  let url: string | null = null;

  if (input.authorId.trim().length === 0) {
    reasons.push("author_required");
  }
  if (title.length < 5 || title.length > 220) {
    reasons.push("title_length_invalid");
  }
  if (BODY_REQUIRED_POST_TYPES.has(postType) && body.length === 0) {
    reasons.push("body_required");
  }
  if (body.length > 40000) {
    reasons.push("body_too_long");
  }
  if (postType === "link" || normalizeBody(input.url).length > 0) {
    try {
      url = normalizeHttpUrl(input.url);
    } catch {
      reasons.push("valid_http_url_required");
    }
  }
  if (postType === "poll" && pollOptions.length < 2) {
    reasons.push("poll_requires_two_options");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    postType,
    title,
    body,
    url,
    tags,
    pollOptions,
    visibility,
  };
}

export function buildPostInsertRow(input: PostDraftInput): PostInsertRow {
  const decision = evaluatePostDraft(input);
  if (!decision.allowed) {
    throw new Error(`Post draft is invalid: ${decision.reasons.join(", ")}`);
  }

  const now = input.now ?? new Date();
  const voteVisibilityHours = Math.max(0, input.voteVisibilityWindowHours ?? 0);
  const voteVisibilityUntil =
    voteVisibilityHours > 0
      ? new Date(now.getTime() + voteVisibilityHours * ONE_HOUR_MS).toISOString()
      : null;

  return {
    zone_id: normalizeNullableId(input.zoneId),
    author_id: input.authorId,
    post_type: decision.postType,
    title: decision.title,
    url: decision.url,
    body: decision.body.length > 0 ? decision.body : null,
    markdown: {
      source_format: "markdown",
      analysis: analyzeMarkdown(decision.body),
      ...(decision.postType === "poll"
        ? {
            poll: {
              options: decision.pollOptions.map((label, index) => ({
                id: `option-${index + 1}`,
                label,
              })),
              multiple_choice: false,
            },
          }
        : {}),
    },
    flair_id: normalizeNullableId(input.flairId),
    tags: decision.tags,
    visibility: decision.visibility,
    status: "published",
    moderation_status: "clear",
    is_locked: false,
    score: 0,
    certified_score: 0,
    comment_count: 0,
    vote_visibility_until: voteVisibilityUntil,
  };
}

export function evaluateCommentDraft(input: CommentDraftInput): {
  allowed: boolean;
  reasons: string[];
  body: string;
} {
  const body = normalizeBody(input.body);
  const hasPost = normalizeNullableId(input.postId) !== null;
  const hasPaper = normalizeNullableId(input.paperId) !== null;
  const reasons: string[] = [];

  if (input.authorId.trim().length === 0) {
    reasons.push("author_required");
  }
  if (hasPost === hasPaper) {
    reasons.push("exactly_one_comment_target_required");
  }
  if (body.length === 0) {
    reasons.push("body_required");
  }
  if (body.length > 40000) {
    reasons.push("body_too_long");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    body,
  };
}

export function buildCommentInsertRow(input: CommentDraftInput): CommentInsertRow {
  const decision = evaluateCommentDraft(input);
  if (!decision.allowed) {
    throw new Error(`Comment draft is invalid: ${decision.reasons.join(", ")}`);
  }

  const analysis = analyzeMarkdown(decision.body);

  return {
    post_id: normalizeNullableId(input.postId),
    paper_id: normalizeNullableId(input.paperId),
    paper_version_id: normalizeNullableId(input.paperVersionId),
    parent_comment_id: normalizeNullableId(input.parentCommentId),
    author_id: input.authorId,
    body: decision.body,
    markdown: {
      source_format: "markdown",
      analysis,
      mentions: analysis.mentions,
      permalink_target: normalizeNullableId(input.postId) ?? normalizeNullableId(input.paperId),
    },
    edit_history: [],
    status: "published",
    moderation_status: "clear",
    is_locked: false,
    score: 0,
    certified_score: 0,
  };
}

export function buildCommentEditPatch(input: {
  previousBody: string;
  previousEditHistory?: unknown;
  newBody: string;
  editorId: string;
  reason?: string;
  now?: Date;
}): {
  body: string;
  markdown: Record<string, unknown>;
  edit_history: CommentEditHistoryEntry[];
} {
  const body = normalizeBody(input.newBody);
  if (body.length === 0 || body.length > 40000) {
    throw new Error("Comment body length is invalid.");
  }

  const entry: CommentEditHistoryEntry = {
    edited_at: (input.now ?? new Date()).toISOString(),
    edited_by: input.editorId,
    previous_body: input.previousBody,
    ...(normalizeBody(input.reason).length > 0 ? { reason: normalizeBody(input.reason) } : {}),
  };
  const editHistory = [...readCommentEditHistory(input.previousEditHistory), entry].slice(-50);
  const analysis = analyzeMarkdown(body);

  return {
    body,
    markdown: {
      source_format: "markdown",
      analysis,
      mentions: analysis.mentions,
      edited: true,
    },
    edit_history: editHistory,
  };
}

export function buildDeletedCommentPatch(
  input: {
    now?: Date;
    anonymize?: boolean;
  } = {},
): Record<string, unknown> {
  const now = (input.now ?? new Date()).toISOString();
  return {
    body: "[deleted]",
    status: "deleted",
    deleted_at: now,
    ...(input.anonymize === true ? { anonymized_at: now } : {}),
  };
}

export function collapseRemovedComment(input: {
  reason: string;
  actorId: string;
  previousBody?: string;
  previousEditHistory?: unknown;
  now?: Date;
}): Record<string, unknown> {
  const reason = normalizeBody(input.reason);
  if (reason.length === 0) {
    throw new Error("Removal reason is required.");
  }

  const removedAt = (input.now ?? new Date()).toISOString();
  const history =
    input.previousBody === undefined
      ? readCommentEditHistory(input.previousEditHistory)
      : [
          ...readCommentEditHistory(input.previousEditHistory),
          {
            edited_at: removedAt,
            edited_by: input.actorId,
            previous_body: input.previousBody,
            reason,
          },
        ].slice(-50);

  return {
    body: "[removed]",
    status: "removed",
    moderation_status: "removed",
    removal_reason: reason,
    edit_history: history,
  };
}

export function buildVoteUpsertRow(input: {
  userId: string;
  targetType: VoteTargetType;
  targetId: string;
  value: VoteValue;
}): {
  user_id: string;
  target_type: VoteTargetType;
  target_id: string;
  value: VoteValue;
  is_certified: false;
  suspicious_score: 0;
} {
  if (input.userId.trim().length === 0 || input.targetId.trim().length === 0) {
    throw new Error("Vote user and target are required.");
  }

  return {
    user_id: input.userId,
    target_type: input.targetType,
    target_id: input.targetId,
    value: input.value,
    is_certified: false,
    suspicious_score: 0,
  };
}

export function applyVoteChange(
  votes: readonly VoteState[],
  change: {
    userId: string;
    targetType: VoteTargetType;
    targetId: string;
    value: VoteValue | null;
    isCertified?: boolean;
    suspiciousScore?: number;
  },
): VoteState[] {
  const remaining = votes.filter(
    (vote) =>
      !(
        vote.userId === change.userId &&
        vote.targetType === change.targetType &&
        vote.targetId === change.targetId
      ),
  );

  if (change.value === null) {
    return remaining;
  }

  return [
    ...remaining,
    {
      userId: change.userId,
      targetType: change.targetType,
      targetId: change.targetId,
      value: change.value,
      isCertified: change.isCertified ?? false,
      suspiciousScore: clampSuspiciousScore(change.suspiciousScore ?? 0),
    },
  ];
}

export function aggregateVotes(
  votes: readonly VoteState[],
  target: { targetType: VoteTargetType; targetId: string },
  suspiciousThreshold = 0.7,
): VoteAggregate {
  let upvotes = 0;
  let downvotes = 0;
  let certifiedScore = 0;
  let pendingScore = 0;
  let suspiciousPendingScore = 0;

  for (const vote of votes) {
    if (vote.targetType !== target.targetType || vote.targetId !== target.targetId) {
      continue;
    }
    if (vote.value === 1) {
      upvotes += 1;
    } else {
      downvotes += 1;
    }
    if (vote.isCertified === true) {
      certifiedScore += vote.value;
    } else {
      pendingScore += vote.value;
      if (clampSuspiciousScore(vote.suspiciousScore ?? 0) >= suspiciousThreshold) {
        suspiciousPendingScore += vote.value;
      }
    }
  }

  const score = upvotes - downvotes;
  const rankableScore = certifiedScore + (pendingScore - suspiciousPendingScore);

  return {
    targetType: target.targetType,
    targetId: target.targetId,
    upvotes,
    downvotes,
    total: upvotes + downvotes,
    score,
    certifiedScore,
    pendingScore,
    suspiciousPendingScore,
    rankableScore,
  };
}

export function buildPublicVoteSummary(
  votes: readonly VoteState[],
  target: { targetType: VoteTargetType; targetId: string },
  options: {
    now?: Date;
    scoreHiddenUntil?: string | Date | null;
    fuzz?: boolean;
  } = {},
): PublicVoteSummary {
  const aggregate = aggregateVotes(votes, target);
  const now = options.now ?? new Date();
  const hiddenUntil =
    options.scoreHiddenUntil === null || options.scoreHiddenUntil === undefined
      ? null
      : new Date(options.scoreHiddenUntil);
  const scoreVisible = hiddenUntil === null || hiddenUntil.getTime() <= now.getTime();
  const visibleScore =
    scoreVisible && options.fuzz === true
      ? fuzzVoteScore(aggregate.score, target.targetId, now)
      : scoreVisible
        ? aggregate.score
        : null;

  return {
    ...aggregate,
    scoreVisible,
    visibleScore,
    scoreHiddenUntil: hiddenUntil?.toISOString() ?? null,
  };
}

export function rankContent<TItem extends RankableContentItem>(
  items: readonly TItem[],
  options: {
    mode?: RankingMode;
    topWindow?: TopWindow;
    now?: Date;
    zoneId?: string | null;
    paperId?: string | null;
  } = {},
): RankedContentItem<TItem>[] {
  const mode = options.mode ?? "hot";
  const now = options.now ?? new Date();
  const windowStart = topWindowStart(options.topWindow ?? "all", now);
  const filtered = items.filter((item) => {
    if (options.zoneId !== undefined && item.zoneId !== options.zoneId) {
      return false;
    }
    if (options.paperId !== undefined && item.paperId !== options.paperId) {
      return false;
    }
    if (mode === "top" && windowStart !== null && toDate(item.createdAt).getTime() < windowStart) {
      return false;
    }
    return true;
  });

  return filtered
    .map((item) => {
      const rankableScore = contentRankableScore(item);
      return {
        item,
        rankScore: scoreForMode(item, mode, rankableScore, now),
        rankableScore,
      };
    })
    .sort((left, right) => {
      const byRank = right.rankScore - left.rankScore;
      if (byRank !== 0) {
        return byRank;
      }
      return toDate(right.item.createdAt).getTime() - toDate(left.item.createdAt).getTime();
    });
}

export type CommentTreeNode<TComment> = TComment & {
  children: Array<CommentTreeNode<TComment>>;
};

export function buildCommentTree<
  TComment extends { id: string; parent_comment_id?: string | null },
>(comments: readonly TComment[]): Array<CommentTreeNode<TComment>> {
  const nodes = new Map<string, CommentTreeNode<TComment>>();
  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, children: [] });
  }

  const roots: Array<CommentTreeNode<TComment>> = [];
  for (const node of nodes.values()) {
    const parentId = node.parent_comment_id ?? null;
    const parent = parentId === null ? undefined : nodes.get(parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return roots;
}

function scoreForMode(
  item: RankableContentItem,
  mode: RankingMode,
  rankableScore: number,
  now: Date,
): number {
  if (mode === "new") {
    return toDate(item.createdAt).getTime();
  }
  if (mode === "top") {
    return rankableScore;
  }
  if (mode === "active") {
    return (
      toDate(item.lastActivityAt ?? item.updatedAt ?? item.createdAt).getTime() +
      (item.commentCount ?? 0) * 1000
    );
  }
  if (mode === "controversial") {
    const upvotes = Math.max(0, item.upvotes ?? Math.max(0, item.score));
    const downvotes = Math.max(0, item.downvotes ?? Math.max(0, -item.score));
    const total = upvotes + downvotes;
    if (total === 0) {
      return 0;
    }
    return Math.min(upvotes, downvotes) - Math.abs(upvotes - downvotes) / total;
  }

  const created = toDate(item.createdAt).getTime();
  const ageHours = Math.max(0, (now.getTime() - created) / ONE_HOUR_MS);
  const signedMagnitude =
    Math.sign(rankableScore) * Math.log10(Math.max(1, Math.abs(rankableScore)));
  return signedMagnitude - ageHours / 36 + (item.commentCount ?? 0) * 0.015;
}

function contentRankableScore(item: RankableContentItem): number {
  const certified = item.certifiedScore ?? 0;
  const pending = item.score - certified;
  const suspicious = item.suspiciousVoteScore ?? 0;
  return certified + (pending - suspicious);
}

function topWindowStart(window: TopWindow, now: Date): number | null {
  if (window === "all") {
    return null;
  }
  const days = window === "day" ? 1 : window === "week" ? 7 : window === "month" ? 31 : 365;
  return now.getTime() - days * 24 * ONE_HOUR_MS;
}

function normalizePollOptions(options: readonly string[] = []): string[] {
  return Array.from(
    new Set(options.map((option) => normalizeWhitespace(option).slice(0, 120)).filter(Boolean)),
  ).slice(0, 10);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeBody(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHttpUrl(value: unknown): string {
  const raw = normalizeBody(value);
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported URL protocol.");
  }
  if (parsed.username || parsed.password || isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error("External URL is not allowed.");
  }
  parsed.hash = "";
  return parsed.toString();
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized === "metadata.google.internal" ||
    !normalized.includes(".")
  ) {
    return true;
  }
  const parts = normalized.split(".").map((part) => Number(part));
  if (
    parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [a = 0, b = 0] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return normalized.includes(":") && (normalized === "::1" || normalized.startsWith("fc"));
}

function countFenceBlocks(source: string): number {
  return Array.from(source.matchAll(/```/g)).length >> 1;
}

function readCommentEditHistory(value: unknown): CommentEditHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const editedAt = typeof entry.edited_at === "string" ? entry.edited_at : null;
    const editedBy = typeof entry.edited_by === "string" ? entry.edited_by : null;
    const previousBody = typeof entry.previous_body === "string" ? entry.previous_body : null;
    if (editedAt === null || editedBy === null || previousBody === null) {
      return [];
    }
    return [
      {
        edited_at: editedAt,
        edited_by: editedBy,
        previous_body: previousBody,
        ...(typeof entry.reason === "string" ? { reason: entry.reason } : {}),
      },
    ];
  });
}

function fuzzVoteScore(score: number, targetId: string, now: Date): number {
  if (Math.abs(score) < 3) {
    return score;
  }
  const bucket = now.toISOString().slice(0, 10);
  const seed = `${targetId}:${bucket}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return score + (seed % 3) - 1;
}

function clampSuspiciousScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
