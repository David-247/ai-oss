export const PACKAGE_NAME = "@ai-oss/research" as const;

export const PAPER_STATUSES = [
  "draft",
  "submitted",
  "published",
  "under_automated_scan",
  "quarantined",
  "flagged",
  "withdrawn",
  "removed_by_moderation",
  "removed_by_legal",
  "superseded",
  "retracted",
  "redacted",
] as const;

export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const PUBLIC_PAPER_STATUSES = [
  "published",
  "withdrawn",
  "superseded",
  "retracted",
  "redacted",
] as const;

export type PublicPaperStatus = (typeof PUBLIC_PAPER_STATUSES)[number];

export const PAPER_VERSION_STATUSES = PAPER_STATUSES.filter((status) => status !== "draft");
export type PaperVersionStatus = Exclude<PaperStatus, "draft">;

export const REVIEW_TYPES = ["structured", "safety", "author_response"] as const;
export type PaperReviewType = (typeof REVIEW_TYPES)[number];

export const REPLICATION_RESULTS = [
  "replicated",
  "partially_replicated",
  "not_replicated",
  "inconclusive",
] as const;
export type ReplicationResult = (typeof REPLICATION_RESULTS)[number];

export const RESEARCH_LICENSES = [
  "cc-by-4.0",
  "cc-by-sa-4.0",
  "cc0-1.0",
  "mit",
  "apache-2.0",
  "other-open",
] as const;

export type ResearchLicense = (typeof RESEARCH_LICENSES)[number];

export interface ResearchAuthorInput {
  name: string;
  profileId?: string | null;
  affiliation?: string | null;
  orcid?: string | null;
  isSubmitter?: boolean;
  isCorresponding?: boolean;
}

export interface ResearchLinkInput {
  type: "code" | "dataset" | "model" | "demo" | "arxiv" | "doi" | "other";
  url: string;
  label?: string | null;
}

export interface ResearchSubmissionInput {
  submitterId: string;
  identifier: string;
  title: string;
  abstract: string;
  authors: readonly ResearchAuthorInput[];
  submitterRelationship: string;
  categories: readonly string[];
  tags?: readonly string[];
  license: string;
  fullText?: string | null;
  fileHashes?: readonly Record<string, unknown>[];
  safetyDisclosure: string;
  modelDataDisclosure: string;
  aiMetadata?: Record<string, unknown>;
  reproducibilityChecklist: Record<string, unknown>;
  uploadRightsConfirmed: boolean;
  notPeerReviewedAcknowledged: boolean;
  contactPreference: "public_email" | "profile" | "platform_messages" | "none";
  conflicts?: string | null;
  links?: readonly ResearchLinkInput[];
  zoneId?: string | null;
  now?: Date;
}

export interface PaperInsertRow {
  identifier: string;
  submitter_id: string;
  zone_id: string | null;
  title: string;
  abstract: string;
  categories: string[];
  tags: string[];
  license: string;
  ai_metadata: Record<string, unknown>;
  status: "submitted";
  current_version_number: 0;
  safety_status: "pending";
  moderation_status: "clear";
  not_peer_reviewed_label_acknowledged: true;
}

export interface PaperVersionInsertRow {
  paper_id: string;
  version_number: number;
  submitter_id: string;
  status: "submitted";
  title_snapshot: string;
  abstract_snapshot: string;
  full_text_snapshot: string | null;
  metadata_snapshot: Record<string, unknown>;
  license_snapshot: string;
  file_hashes: readonly Record<string, unknown>[];
  text_diff_from_previous: string | null;
}

export interface PaperAuthorInsertRow {
  paper_id: string;
  profile_id: string | null;
  author_name: string;
  author_slug: string;
  author_order: number;
  affiliation: string | null;
  orcid: string | null;
  is_submitter: boolean;
  is_corresponding: boolean;
}

export interface PaperLinkInsertRow {
  paper_id: string;
  link_type: ResearchLinkInput["type"];
  url: string;
  label: string | null;
}

export interface PublishingChecks {
  malwareScan: "pass" | "fail" | "pending";
  metadataValidation: "pass" | "fail";
  licenseAttestation: "pass" | "fail";
  safetyCheck: "pass" | "flag" | "block" | "pending";
  legalCheck: "pass" | "flag" | "block" | "pending";
}

export interface PublishingDecision {
  status: PaperStatus;
  versionStatus: PaperVersionStatus;
  safetyStatus: "pending" | "clear" | "flagged" | "blocked";
  moderationStatus: "clear" | "flagged" | "quarantined" | "removed";
  publishable: boolean;
  reasons: string[];
}

export interface PaperCitationInput {
  identifier: string;
  title: string;
  authors: readonly { name: string }[];
  abstract?: string;
  license?: string;
  year: number;
  url?: string;
}

export interface PaperPageDescriptor {
  identifier: string;
  title: string;
  versionLabel: string;
  notPeerReviewedLabel: "Not peer reviewed / not platform endorsed";
  citation: {
    bibtex: string;
    ris: string;
    cslJson: Record<string, unknown>;
  };
  statusBadges: string[];
}

export interface PaperReviewInput {
  paperId: string;
  paperVersionId?: string | null;
  reviewerId: string;
  reviewType: PaperReviewType;
  body: string;
  scores?: Partial<
    Record<
      "clarity" | "novelty" | "methodology" | "reproducibility" | "safety" | "evidence",
      number
    >
  >;
}

export interface ReplicationReportInput {
  paperId: string;
  paperVersionId?: string | null;
  reporterId: string;
  environment?: string | null;
  hardware?: string | null;
  dataSnapshot?: string | null;
  commitHash?: string | null;
  resultStatus: ReplicationResult;
  notes: string;
}

export interface RankablePaper {
  id: string;
  createdAt: string | Date;
  voteScore: number;
  reviewScore?: number;
  replicationScore?: number;
  safetyStatus?: string;
  legalHold?: boolean;
  authorReputation?: number;
  zoneRelevance?: number;
}

export function generatePaperIdentifier(input: { sequence: number; now?: Date }): string {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const sequence = Math.max(1, Math.trunc(input.sequence));
  return `AIOSS:${year}${month}.${String(sequence).padStart(5, "0")}`;
}

export function formatVersionIdentifier(identifier: string, versionNumber: number): string {
  return `${identifier}v${versionNumber}`;
}

export function nextVersionNumber(
  versions: readonly { version_number?: number; versionNumber?: number }[],
): number {
  return (
    versions.reduce((max, version) => {
      const value = Number(version.version_number ?? version.versionNumber ?? 0);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1
  );
}

export function validateResearchSubmission(input: ResearchSubmissionInput): {
  allowed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!input.submitterId.trim()) {
    reasons.push("submitter_required");
  }
  if (!/^AIOSS:\d{6}\.\d{5}$/.test(input.identifier)) {
    reasons.push("identifier_invalid");
  }
  if (normalizeText(input.title).length < 5 || normalizeText(input.title).length > 300) {
    reasons.push("title_length_invalid");
  }
  if (normalizeText(input.abstract).length < 25 || normalizeText(input.abstract).length > 8000) {
    reasons.push("abstract_length_invalid");
  }
  if (input.authors.length === 0 || input.authors.some((author) => !normalizeText(author.name))) {
    reasons.push("authors_required");
  }
  if (!normalizeText(input.submitterRelationship)) {
    reasons.push("submitter_relationship_required");
  }
  if (normalizeTags(input.categories).length === 0) {
    reasons.push("category_required");
  }
  if (!RESEARCH_LICENSES.includes(input.license as ResearchLicense)) {
    reasons.push("license_required");
  }
  if (!normalizeText(input.fullText) && (input.fileHashes ?? []).length === 0) {
    reasons.push("pdf_or_full_text_required");
  }
  if (!normalizeText(input.safetyDisclosure)) {
    reasons.push("safety_disclosure_required");
  }
  if (!normalizeText(input.modelDataDisclosure)) {
    reasons.push("model_data_disclosure_required");
  }
  if (Object.keys(input.reproducibilityChecklist).length === 0) {
    reasons.push("reproducibility_checklist_required");
  }
  if (!input.uploadRightsConfirmed) {
    reasons.push("upload_rights_confirmation_required");
  }
  if (!input.notPeerReviewedAcknowledged) {
    reasons.push("not_peer_reviewed_acknowledgement_required");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function buildPaperInsertRow(input: ResearchSubmissionInput): PaperInsertRow {
  assertValidSubmission(input);
  return {
    identifier: input.identifier,
    submitter_id: input.submitterId,
    zone_id: normalizeNullable(input.zoneId),
    title: normalizeText(input.title),
    abstract: normalizeText(input.abstract),
    categories: normalizeTags(input.categories),
    tags: normalizeTags(input.tags ?? []),
    license: input.license,
    ai_metadata: input.aiMetadata ?? {},
    status: "submitted",
    current_version_number: 0,
    safety_status: "pending",
    moderation_status: "clear",
    not_peer_reviewed_label_acknowledged: true,
  };
}

export function buildPaperVersionInsertRow(
  input: ResearchSubmissionInput,
  options: {
    paperId: string;
    versionNumber: number;
    previousFullText?: string | null;
  },
): PaperVersionInsertRow {
  assertValidSubmission(input);
  const fullText = normalizeText(input.fullText) || null;
  return {
    paper_id: options.paperId,
    version_number: options.versionNumber,
    submitter_id: input.submitterId,
    status: "submitted",
    title_snapshot: normalizeText(input.title),
    abstract_snapshot: normalizeText(input.abstract),
    full_text_snapshot: fullText,
    metadata_snapshot: buildMetadataSnapshot(input),
    license_snapshot: input.license,
    file_hashes: input.fileHashes ?? [],
    text_diff_from_previous: buildTextDiffSummary(options.previousFullText ?? null, fullText),
  };
}

export function buildPaperAuthorRows(
  input: ResearchSubmissionInput,
  paperId: string,
): PaperAuthorInsertRow[] {
  assertValidSubmission(input);
  return input.authors.map((author, index) => ({
    paper_id: paperId,
    profile_id: normalizeNullable(author.profileId),
    author_name: normalizeText(author.name),
    author_slug: slugify(author.name),
    author_order: index + 1,
    affiliation: normalizeNullable(author.affiliation),
    orcid: normalizeNullable(author.orcid),
    is_submitter:
      author.isSubmitter === true || normalizeNullable(author.profileId) === input.submitterId,
    is_corresponding: author.isCorresponding === true,
  }));
}

export function buildPaperLinkRows(
  input: ResearchSubmissionInput,
  paperId: string,
): PaperLinkInsertRow[] {
  return (input.links ?? []).map((link) => ({
    paper_id: paperId,
    link_type: link.type,
    url: normalizeHttpUrl(link.url),
    label: normalizeNullable(link.label),
  }));
}

export function evaluatePublishingChecks(input: PublishingChecks): PublishingDecision {
  const reasons: string[] = [];
  if (input.malwareScan === "pending") {
    reasons.push("malware_scan_pending");
  }
  if (input.malwareScan === "fail") {
    reasons.push("malware_scan_failed");
  }
  if (input.metadataValidation === "fail") {
    reasons.push("metadata_validation_failed");
  }
  if (input.licenseAttestation === "fail") {
    reasons.push("license_attestation_failed");
  }
  if (input.safetyCheck === "pending") {
    reasons.push("safety_check_pending");
  }
  if (input.safetyCheck === "flag") {
    reasons.push("safety_check_flagged");
  }
  if (input.safetyCheck === "block") {
    reasons.push("safety_check_blocked");
  }
  if (input.legalCheck === "pending") {
    reasons.push("legal_check_pending");
  }
  if (input.legalCheck === "flag") {
    reasons.push("legal_check_flagged");
  }
  if (input.legalCheck === "block") {
    reasons.push("legal_check_blocked");
  }

  if (
    input.safetyCheck === "block" ||
    input.legalCheck === "block" ||
    input.malwareScan === "fail"
  ) {
    return {
      status: "quarantined",
      versionStatus: "quarantined",
      safetyStatus: input.safetyCheck === "block" ? "blocked" : "flagged",
      moderationStatus: "quarantined",
      publishable: false,
      reasons,
    };
  }

  if (input.safetyCheck === "flag" || input.legalCheck === "flag") {
    return {
      status: "flagged",
      versionStatus: "flagged",
      safetyStatus: "flagged",
      moderationStatus: "flagged",
      publishable: false,
      reasons,
    };
  }

  if (reasons.length > 0) {
    return {
      status: "under_automated_scan",
      versionStatus: "under_automated_scan",
      safetyStatus: "pending",
      moderationStatus: "clear",
      publishable: false,
      reasons,
    };
  }

  return {
    status: "published",
    versionStatus: "published",
    safetyStatus: "clear",
    moderationStatus: "clear",
    publishable: true,
    reasons: [],
  };
}

export function buildCitationExports(input: PaperCitationInput) {
  const key = input.identifier.replace(/[^A-Za-z0-9]/g, "");
  const authorText = input.authors.map((author) => author.name).join(" and ");
  const url =
    input.url ?? `https://www.ai-oss.net/research/${encodeURIComponent(input.identifier)}`;
  return {
    bibtex: [
      `@misc{${key},`,
      `  title = {${input.title}},`,
      `  author = {${authorText}},`,
      `  year = {${input.year}},`,
      `  howpublished = {AI-OSS.net},`,
      `  note = {${input.identifier}},`,
      `  url = {${url}}`,
      `}`,
    ].join("\n"),
    ris: [
      "TY  - GEN",
      `TI  - ${input.title}`,
      ...input.authors.map((author) => `AU  - ${author.name}`),
      `PY  - ${input.year}`,
      `ID  - ${input.identifier}`,
      `UR  - ${url}`,
      "ER  - ",
    ].join("\n"),
    cslJson: {
      type: "article",
      id: input.identifier,
      title: input.title,
      abstract: input.abstract,
      issued: { "date-parts": [[input.year]] },
      author: input.authors.map((author) => ({ literal: author.name })),
      URL: url,
      license: input.license,
    },
  };
}

export function buildPaperPageDescriptor(input: {
  paper: {
    identifier: string;
    title: string;
    status: string;
    safety_status?: string;
    legal_hold?: boolean;
  };
  version: { version_number: number; submitted_at?: string };
  authors: readonly { author_name?: string; name?: string }[];
  abstract?: string;
  license?: string;
}): PaperPageDescriptor {
  const year = input.version.submitted_at
    ? new Date(input.version.submitted_at).getUTCFullYear()
    : new Date().getUTCFullYear();
  const citation = buildCitationExports({
    identifier: input.paper.identifier,
    title: input.paper.title,
    abstract: input.abstract,
    license: input.license,
    year,
    authors: input.authors.map((author) => ({ name: author.author_name ?? author.name ?? "" })),
  });

  return {
    identifier: input.paper.identifier,
    title: input.paper.title,
    versionLabel: formatVersionIdentifier(input.paper.identifier, input.version.version_number),
    notPeerReviewedLabel: "Not peer reviewed / not platform endorsed",
    citation,
    statusBadges: [
      input.paper.status,
      ...(input.paper.safety_status && input.paper.safety_status !== "clear"
        ? [`safety:${input.paper.safety_status}`]
        : []),
      ...(input.paper.legal_hold === true ? ["legal_hold"] : []),
    ],
  };
}

export function buildReviewInsertRow(input: PaperReviewInput): Record<string, unknown> {
  if (!REVIEW_TYPES.includes(input.reviewType)) {
    throw new Error("Unknown review type.");
  }
  if (normalizeText(input.body).length < 10) {
    throw new Error("Review body is required.");
  }
  return {
    paper_id: input.paperId,
    paper_version_id: normalizeNullable(input.paperVersionId),
    reviewer_id: input.reviewerId,
    review_type: input.reviewType,
    clarity_score: normalizeScore(input.scores?.clarity),
    novelty_score: normalizeScore(input.scores?.novelty),
    methodology_score: normalizeScore(input.scores?.methodology),
    reproducibility_score: normalizeScore(input.scores?.reproducibility),
    safety_score: normalizeScore(input.scores?.safety),
    evidence_score: normalizeScore(input.scores?.evidence),
    body: normalizeText(input.body),
    status: "published",
    moderation_status: "clear",
  };
}

export function buildReplicationReportInsertRow(
  input: ReplicationReportInput,
): Record<string, unknown> {
  if (!REPLICATION_RESULTS.includes(input.resultStatus)) {
    throw new Error("Unknown replication result.");
  }
  if (normalizeText(input.notes).length < 10) {
    throw new Error("Replication notes are required.");
  }
  return {
    paper_id: input.paperId,
    paper_version_id: normalizeNullable(input.paperVersionId),
    reporter_id: input.reporterId,
    environment: normalizeNullable(input.environment),
    hardware: normalizeNullable(input.hardware),
    data_snapshot: normalizeNullable(input.dataSnapshot),
    commit_hash: normalizeNullable(input.commitHash),
    result_status: input.resultStatus,
    notes: normalizeText(input.notes),
    status: "published",
    moderation_status: "clear",
  };
}

export function rankPapers<TPaper extends RankablePaper>(
  papers: readonly TPaper[],
  now = new Date(),
): TPaper[] {
  return [...papers].sort((left, right) => paperRank(right, now) - paperRank(left, now));
}

export function paperRank(paper: RankablePaper, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(paper.createdAt).getTime()) / 86400000);
  const safetyPenalty =
    paper.legalHold === true
      ? 100
      : paper.safetyStatus === "blocked"
        ? 80
        : paper.safetyStatus === "flagged"
          ? 35
          : 0;
  return (
    paper.voteScore * 0.35 +
    (paper.reviewScore ?? 0) * 4 +
    (paper.replicationScore ?? 0) * 3 +
    (paper.authorReputation ?? 0) * 0.05 +
    (paper.zoneRelevance ?? 0) * 2 -
    ageDays * 0.15 -
    safetyPenalty
  );
}

function assertValidSubmission(input: ResearchSubmissionInput): void {
  const validation = validateResearchSubmission(input);
  if (!validation.allowed) {
    throw new Error(`Research submission is invalid: ${validation.reasons.join(", ")}`);
  }
}

function buildMetadataSnapshot(input: ResearchSubmissionInput): Record<string, unknown> {
  return {
    submitter_relationship: normalizeText(input.submitterRelationship),
    safety_disclosure: normalizeText(input.safetyDisclosure),
    model_data_disclosure: normalizeText(input.modelDataDisclosure),
    ai_metadata: input.aiMetadata ?? {},
    reproducibility_checklist: input.reproducibilityChecklist,
    upload_rights_confirmed: input.uploadRightsConfirmed,
    not_peer_reviewed_acknowledged: input.notPeerReviewedAcknowledged,
    contact_preference: input.contactPreference,
    conflicts: normalizeNullable(input.conflicts),
    categories: normalizeTags(input.categories),
    tags: normalizeTags(input.tags ?? []),
    links: input.links ?? [],
    platform_endorsement: false,
  };
}

function buildTextDiffSummary(previous: string | null, next: string | null): string | null {
  if (previous === null || next === null) {
    return null;
  }
  if (previous === next) {
    return "No full-text changes.";
  }
  return `Full text changed from ${previous.length} to ${next.length} characters.`;
}

function normalizeTags(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_.-]/g, "")
            .slice(0, 64),
        )
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text ? text : null;
}

function normalizeHttpUrl(value: string): string {
  const parsed = new URL(value);
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

function slugify(value: string): string {
  return (
    normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "author"
  );
}

function normalizeScore(value: unknown): number | null {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return null;
  }
  return Math.min(5, Math.max(1, Math.trunc(score)));
}
