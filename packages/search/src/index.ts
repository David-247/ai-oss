export const PACKAGE_NAME = "@ai-oss/search" as const;

export const SEARCH_TARGET_TYPES = [
  "zone",
  "post",
  "comment",
  "paper",
  "paper_full_text",
  "paper_review",
  "replication_report",
  "user",
  "tag",
  "chat_message",
] as const;
export type SearchTargetType = (typeof SEARCH_TARGET_TYPES)[number];

export const SEARCH_VISIBILITIES = [
  "public",
  "authenticated",
  "zone",
  "private",
  "moderator",
  "admin",
] as const;
export type SearchVisibility = (typeof SEARCH_VISIBILITIES)[number];

export const RESEARCH_SEARCH_FIELDS = [
  "title",
  "abstract",
  "full_text",
  "authors",
  "tags",
  "categories",
  "identifier",
  "links",
  "license",
  "status",
  "date",
  "zone",
  "review_status",
  "replication_status",
] as const;

export interface SearchDocumentInput {
  targetType: SearchTargetType;
  targetId: string;
  title: string;
  body: string;
  visibility?: SearchVisibility;
  zoneId?: string | null;
  metadata?: Record<string, unknown>;
  sourceUpdatedAt?: string | Date | null;
  embedding?: readonly number[] | null;
  embeddingStatus?: "pending" | "ready" | "failed" | "not_required";
  now?: Date;
}

export interface SearchDocumentRow {
  target_type: SearchTargetType;
  target_id: string;
  visibility: SearchVisibility;
  zone_id: string | null;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  source_updated_at: string | null;
  deleted_at: null;
  embedding_status: "pending" | "ready" | "failed" | "not_required";
  indexed_at: string;
  is_fresh: boolean;
  embedding?: string | null;
}

export interface SearchViewer {
  userId: string | null;
  authenticated: boolean;
  readableZoneIds: readonly string[];
  moderatorZoneIds: readonly string[];
  canReadAdmin: boolean;
}

export interface SearchResult {
  id?: string;
  target_type: string;
  target_id: string;
  visibility: string;
  zone_id?: string | null;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  source_updated_at?: string | null;
  indexed_at?: string | null;
  rank?: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export function normalizeSearchQuery(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, " ").slice(0, 240);
}

export function parseSearchTargetTypes(value: unknown): SearchTargetType[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : SEARCH_TARGET_TYPES;
  const parsed = raw
    .map((item) => normalizeText(item))
    .filter((item): item is SearchTargetType =>
      SEARCH_TARGET_TYPES.includes(item as SearchTargetType),
    );
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...SEARCH_TARGET_TYPES];
}

export function buildSearchDocumentUpsertRow(input: SearchDocumentInput): SearchDocumentRow {
  const targetId = normalizeText(input.targetId);
  const title = sanitizeSearchText(input.title).slice(0, 500);
  const body = sanitizeSearchText(input.body).slice(0, 200000);
  if (!targetId) {
    throw new Error("Search document target id is required.");
  }
  if (!title) {
    throw new Error("Search document title is required.");
  }
  if (!SEARCH_TARGET_TYPES.includes(input.targetType)) {
    throw new Error("Search document target type is invalid.");
  }
  const visibility = SEARCH_VISIBILITIES.includes(input.visibility as SearchVisibility)
    ? (input.visibility as SearchVisibility)
    : "public";
  const embedding = input.embedding ? serializeEmbedding(input.embedding) : null;
  return {
    target_type: input.targetType,
    target_id: targetId,
    visibility,
    zone_id: normalizeNullable(input.zoneId),
    title,
    body,
    metadata: {
      ...readMetadata(input.metadata),
      indexed_fields:
        input.targetType === "paper" || input.targetType === "paper_full_text"
          ? RESEARCH_SEARCH_FIELDS
          : undefined,
    },
    source_updated_at: input.sourceUpdatedAt ? new Date(input.sourceUpdatedAt).toISOString() : null,
    deleted_at: null,
    embedding_status: input.embeddingStatus ?? (embedding === null ? "pending" : "ready"),
    indexed_at: (input.now ?? new Date()).toISOString(),
    is_fresh: true,
    ...(embedding === null ? {} : { embedding }),
  };
}

export function buildSearchDocumentPurgePatch(input: { now?: Date; reason?: string | null }) {
  return {
    deleted_at: (input.now ?? new Date()).toISOString(),
    is_fresh: false,
    metadata: {
      purge_reason: normalizeNullable(input.reason) ?? "visibility_or_deletion",
      purged_from_public_index: true,
    },
  };
}

export function canReadSearchDocument(row: SearchResult, viewer: SearchViewer): boolean {
  const visibility = row.visibility;
  if (visibility === "public") {
    return true;
  }
  if (!viewer.authenticated) {
    return false;
  }
  if (visibility === "authenticated") {
    return true;
  }
  const zoneId = normalizeNullable(row.zone_id);
  if (visibility === "zone") {
    return zoneId !== null && viewer.readableZoneIds.includes(zoneId);
  }
  if (visibility === "moderator") {
    return zoneId !== null && viewer.moderatorZoneIds.includes(zoneId);
  }
  if (visibility === "admin") {
    return viewer.canReadAdmin;
  }
  const ownerId = normalizeNullable(row.metadata?.owner_id);
  return ownerId !== null && ownerId === viewer.userId;
}

export function rankSearchResult(input: {
  row: SearchResult;
  query: string;
  semanticScore?: number | null;
  now?: Date;
}): number {
  const queryTerms = tokenize(input.query);
  const haystackTitle = input.row.title.toLowerCase();
  const haystackBody = input.row.body.toLowerCase();
  const keywordScore = queryTerms.reduce((score, term) => {
    const titleHit = haystackTitle.includes(term) ? 2 : 0;
    const bodyHit = haystackBody.includes(term) ? 1 : 0;
    return score + titleHit + bodyHit;
  }, 0);
  const semantic = Math.max(0, Math.min(1, input.semanticScore ?? 0));
  const freshness = freshnessBoost(input.row.source_updated_at ?? input.row.indexed_at, input.now);
  const certification = input.row.metadata?.certified === true ? 0.15 : 0;
  return Number((keywordScore + semantic * 3 + freshness + certification).toFixed(4));
}

export function buildSearchFacets(results: readonly SearchResult[]) {
  return {
    targetTypes: countBuckets(results.map((result) => result.target_type)),
    visibility: countBuckets(results.map((result) => result.visibility)),
    tags: countBuckets(results.flatMap((result) => readStringArray(result.metadata?.tags))),
    categories: countBuckets(
      results.flatMap((result) => readStringArray(result.metadata?.categories)),
    ),
    licenses: countBuckets(
      results.map((result) => normalizeText(result.metadata?.license)).filter(Boolean),
    ),
  };
}

export function buildSuggestions(
  rows: readonly Pick<SearchResult, "title" | "target_type" | "metadata">[],
  query: string,
  limit = 10,
) {
  const normalized = normalizeSearchQuery(query).toLowerCase();
  const suggestions = new Map<string, { label: string; targetType: string; weight: number }>();
  for (const row of rows) {
    const candidates = [
      row.title,
      ...readStringArray(row.metadata?.tags),
      ...readStringArray(row.metadata?.authors),
      normalizeText(row.metadata?.identifier),
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (normalized && !candidate.toLowerCase().includes(normalized)) {
        continue;
      }
      const key = candidate.toLowerCase();
      const current = suggestions.get(key);
      const weight = candidate.toLowerCase().startsWith(normalized) ? 2 : 1;
      if (current === undefined || current.weight < weight) {
        suggestions.set(key, { label: candidate, targetType: row.target_type, weight });
      }
    }
  }
  return Array.from(suggestions.values())
    .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export function buildPublicPaperMetadata(input: {
  paper: Record<string, unknown>;
  versions?: readonly Record<string, unknown>[];
  authors?: readonly Record<string, unknown>[];
  links?: readonly Record<string, unknown>[];
}) {
  return {
    id: normalizeText(input.paper.id),
    identifier: normalizeText(input.paper.identifier),
    title: normalizeText(input.paper.title),
    abstract: normalizeText(input.paper.abstract),
    status: normalizeText(input.paper.status),
    license: normalizeText(input.paper.license),
    tags: readStringArray(input.paper.tags),
    categories: readStringArray(input.paper.categories),
    publishedAt: normalizeNullable(input.paper.published_at),
    updatedAt: normalizeNullable(input.paper.updated_at),
    authors: input.authors ?? [],
    links: input.links ?? [],
    versions: input.versions ?? [],
  };
}

export function buildSitemapXml(entries: readonly { loc: string; lastmod?: string | null }[]) {
  const body = entries
    .map(
      (entry) =>
        `<url><loc>${escapeXml(entry.loc)}</loc>${
          entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""
        }</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function buildAtomFeed(input: {
  title: string;
  id: string;
  updated: string;
  entries: readonly {
    id: string;
    title: string;
    href: string;
    updated: string;
    summary?: string | null;
  }[];
}) {
  const entries = input.entries
    .map(
      (entry) =>
        `<entry><id>${escapeXml(entry.id)}</id><title>${escapeXml(entry.title)}</title><link href="${escapeXml(
          entry.href,
        )}"/><updated>${escapeXml(entry.updated)}</updated><summary>${escapeXml(
          entry.summary ?? "",
        )}</summary></entry>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${escapeXml(
    input.id,
  )}</id><title>${escapeXml(input.title)}</title><updated>${escapeXml(
    input.updated,
  )}</updated>${entries}</feed>`;
}

export function buildLlmsTxt(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [
    "# AI-OSS.net",
    "",
    "AI-OSS.net publishes public AI research metadata, paper abstracts, version records, reviews, replication reports, zones, posts, and tags.",
    "",
    "Public archive API:",
    `- Papers: ${base}/api/public/papers`,
    `- Search: ${base}/api/search?q=keyword`,
    "",
    "Access policy:",
    "- Public endpoints expose public or otherwise authorized records only.",
    "- Private zones, private chat, quarantined content, deleted content, moderator-only records, and admin records are not available to crawlers.",
    "- Automated clients should respect robots.txt and cache headers.",
  ].join("\n");
}

function sanitizeSearchText(value: unknown): string {
  return normalizeText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[`*_#>[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serializeEmbedding(embedding: readonly number[]): string {
  if (embedding.length !== 1536) {
    throw new Error("Search embeddings must be 1536 dimensions.");
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Search embeddings must be finite numbers.");
  }
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function freshnessBoost(value: string | null | undefined, now = new Date()): number {
  if (!value) {
    return 0;
  }
  const ageDays = Math.max(0, (now.getTime() - new Date(value).getTime()) / 86_400_000);
  return Math.max(0, 1 - ageDays / 365);
}

function tokenize(query: string): string[] {
  return normalizeSearchQuery(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 20);
}

function countBuckets(values: readonly string[]): FacetBucket[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function readMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
