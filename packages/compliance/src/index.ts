export const PACKAGE_NAME = "@ai-oss/compliance" as const;

export const MINIMUM_ACCOUNT_AGE = 18;
export const DO_NOT_SELL_OR_SHARE_DEFAULT = true;
export const BEHAVIORAL_ADVERTISING_AT_LAUNCH = false;

export const PRIVACY_REQUEST_TYPES = [
  "export",
  "delete",
  "rectify",
  "restrict_processing",
  "objection",
  "opt_out_sale_share",
  "limit_sensitive_data",
  "automated_decision_review",
] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const LEGAL_REQUEST_TYPES = [
  "dmca_takedown",
  "dmca_counter_notice",
  "dsa_notice",
  "osa_illegal_content",
  "underage_report",
  "child_safety_escalation",
  "law_enforcement",
  "privacy_regulator",
] as const;
export type LegalRequestType = (typeof LEGAL_REQUEST_TYPES)[number];

export const LEGAL_POLICY_SLUGS = [
  "privacy",
  "terms",
  "cookies",
  "dmca",
  "community-guidelines",
  "research-policy",
  "moderator-code",
  "transparency",
  "dsa",
  "online-safety",
] as const;
export type LegalPolicySlug = (typeof LEGAL_POLICY_SLUGS)[number];

export interface LegalPolicyPage {
  slug: LegalPolicySlug;
  title: string;
  version: string;
  updatedAt: string;
  summary: string;
  sections: readonly {
    heading: string;
    body: readonly string[];
  }[];
}

export const COOKIE_CATEGORIES = [
  {
    key: "strictly_necessary",
    label: "Strictly Necessary",
    required: true,
    vendors: ["AI-OSS.net", "Supabase Auth", "Vercel"],
  },
  {
    key: "analytics",
    label: "Privacy-Preserving Analytics",
    required: false,
    vendors: ["AI-OSS.net"],
  },
  {
    key: "marketing",
    label: "Marketing",
    required: false,
    vendors: [],
  },
] as const;

export const PROCESSING_RECORDS = [
  record("account_identity", "Account creation, login, security, age attestation", "contract"),
  record("research_archive", "Research submission, publication, versioning", "contract"),
  record("community_moderation", "Reports, moderation, appeals, safety enforcement", "legitimate_interest"),
  record("donation_finance", "Donation accounting, fraud, refund, chargeback records", "legal_obligation"),
  record("legal_compliance", "DMCA, DSA, OSA, privacy rights, legal holds", "legal_obligation"),
] as const;

export const VENDOR_REGISTER = [
  vendor("Supabase", "Authentication, database, storage primitives", "DPA required"),
  vendor("Vercel", "Hosting, edge/runtime, logs, marketplace integrations", "DPA required"),
  vendor("Stripe", "Donation payment processing", "Payment processor terms and DPA required"),
  vendor("LiveKit", "Opt-in voice room transport", "DPA required before production voice"),
] as const;

export const RETENTION_SCHEDULES = [
  retention("account_profile", "Active account lifetime; deletion/anonymization after verified request"),
  retention("public_research_versions", "Preserved as archive records; withdraw/redact rather than destroy"),
  retention("moderation_records", "Retained for safety, appeals, legal, and transparency obligations"),
  retention("donation_records", "Financial/tax/fraud/chargeback/accounting obligation"),
  retention("legal_requests", "Retained for legal defense, statutory compliance, and transparency reporting"),
] as const;

export const LEGAL_POLICY_PAGES: readonly LegalPolicyPage[] = [
  policy("privacy", "Privacy Policy", "Privacy by design, rights requests, no sale/share default.", [
    section("Your Rights", [
      "You can request access/export, correction, deletion/anonymization, restriction, portability, objection, and automated-decision review where applicable.",
      "AI-OSS.net defaults to no sale or sharing of personal information and honors Global Privacy Control signals where applicable.",
    ]),
    section("Data Minimization", [
      "We collect account, security, research, moderation, donation, and legal records needed to operate the platform.",
      "Admin access to personal data is permission-gated, audited, and limited to operational, safety, legal, privacy, security, and finance needs.",
    ]),
    section("Retention", RETENTION_SCHEDULES.map((item) => `${item.key}: ${item.rule}`)),
  ]),
  policy("terms", "Terms", "Platform terms, age policy, acceptable use, and moderation baseline.", [
    section("Age Policy", [
      `AI-OSS.net is not directed to children under 13 and launch access requires age attestation that the user is at least ${MINIMUM_ACCOUNT_AGE}.`,
      "Users must not submit child sexual abuse material, grooming, illegal content, or content that violates the research and community policies.",
    ]),
    section("Moderation", [
      "Rules are enforced through reports, AutoMod, moderator action, appeal, legal escalation, and transparency reporting.",
      "Donations do not buy account privileges, ranking, governance power, moderation access, or publishing priority.",
    ]),
  ]),
  policy("cookies", "Cookie Policy", "Strictly necessary cookies plus withdrawable nonessential consent.", [
    section("Categories", COOKIE_CATEGORIES.map((category) => `${category.label}: vendors ${category.vendors.join(", ") || "none"}.`)),
    section("Advertising", [
      "AI-OSS.net has no behavioral advertising at launch.",
      "Nonessential analytics require consent where legally required and can be withdrawn.",
    ]),
  ]),
  policy("dmca", "DMCA Policy", "Copyright takedown, counter-notice, repeat-infringer, and legal holds.", [
    section("Takedown Intake", [
      "Copyright owners can submit a takedown notice identifying the work, allegedly infringing material, contact information, good-faith statement, and signature.",
      "Counter-notices can be submitted when content was removed by mistake or misidentification.",
    ]),
    section("Repeat Infringer", [
      "Repeat-infringer signals are tracked in legal requests and moderation records.",
      "Legal holds can preserve relevant records while disabling access to material where required.",
    ]),
  ]),
  policy("community-guidelines", "Community Guidelines", "Safety, research integrity, and no dark patterns in reporting.", [
    section("Illegal Content", [
      "Illegal content, harassment, spam, coordinated manipulation, CSAM, grooming, and unsafe abuse are prohibited.",
      "Reports and appeals remain accessible and do not require dark-pattern flows.",
    ]),
  ]),
  policy("research-policy", "Research Publishing Policy", "Research metadata, AI safety baseline, and archive rules.", [
    section("AI Metadata", [
      "AI-related submissions should include model/provider identity, license, training-data summary, intended use, limitations, evaluation results, known risks, responsible-disclosure status, and export-control/sanctions warning where applicable.",
      "Published research versions are withdrawn, redacted, or pseudonymized when needed; they are not silently destroyed.",
    ]),
  ]),
  policy("moderator-code", "Moderator Code", "Scoped authority, audits, appeals, and legal escalation.", [
    section("Accountability", [
      "Moderator and admin actions are permission-scoped and audited.",
      "DSA/OSA-compatible decisions include policy, facts, appealability, and jurisdiction where applicable.",
    ]),
  ]),
  policy("transparency", "Transparency", "Transparency report buckets and public aggregate disclosures.", [
    section("Report Data", [
      "Transparency events collect public aggregate counts for reports, legal requests, privacy requests, removals, appeals, and safety escalations.",
      "Public reports avoid exposing private reporter, requester, or underage information.",
    ]),
  ]),
  policy("dsa", "DSA", "EU DSA notice-and-action, receipts, decisions, and appeals.", [
    section("Notice And Action", [
      "Illegal-content notices receive receipt confirmation, review status, decision notification, statement of reasons where applicable, and internal complaint/appeal paths.",
      "Trusted-flagger support can be enabled later without weakening ordinary user reporting access.",
    ]),
  ]),
  policy("online-safety", "Online Safety", "UK OSA illegal-content reporting, redress, and child-safety escalation.", [
    section("Safety Measures", [
      "The platform maintains illegal-content reporting, redress, moderation records, crisis protocol metadata, and proportionate safety measures.",
      "Underage, CSAM, and grooming reports receive child-safety escalation and legal review workflows.",
    ]),
  ]),
] as const;

export interface PrivacyRequestInput {
  userId: string;
  requestType: unknown;
  jurisdiction?: unknown;
  message?: unknown;
  gpcSignal?: unknown;
  doNotSellShare?: unknown;
  limitSensitiveData?: unknown;
  now?: Date;
}

export interface LegalRequestInput {
  requestType: LegalRequestType;
  requester: unknown;
  requesterEmail?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  targetUrl?: unknown;
  jurisdiction?: unknown;
  description?: unknown;
  statement?: unknown;
  signature?: unknown;
  source?: unknown;
  now?: Date;
}

export interface AiMetadataInput {
  modelProvider?: unknown;
  modelName?: unknown;
  modelLicense?: unknown;
  trainingDataSummary?: unknown;
  intendedUse?: unknown;
  limitations?: unknown;
  evaluationResults?: unknown;
  knownRisks?: unknown;
  responsibleDisclosureStatus?: unknown;
  exportControlNoticeAccepted?: unknown;
}

export function legalPolicyForSlug(slug: string): LegalPolicyPage | null {
  return LEGAL_POLICY_PAGES.find((page) => page.slug === slug) ?? null;
}

export function legalPolicySummaries() {
  return LEGAL_POLICY_PAGES.map(({ slug, title, version, updatedAt, summary }) => ({
    slug,
    title,
    version,
    updatedAt,
    summary,
  }));
}

export function normalizePrivacyRequestType(value: unknown): PrivacyRequestType {
  const text = readString(value).toLowerCase();
  const aliases: Record<string, PrivacyRequestType> = {
    access: "export",
    correction: "rectify",
    deletion: "delete",
    portability: "export",
    gpc: "opt_out_sale_share",
    do_not_sell_share: "opt_out_sale_share",
    limit_sensitive_use: "limit_sensitive_data",
  };
  const normalized = aliases[text] ?? text;
  if (PRIVACY_REQUEST_TYPES.includes(normalized as PrivacyRequestType)) {
    return normalized as PrivacyRequestType;
  }
  throw new Error("Unsupported privacy request type.");
}

export function privacyRequestDueAt(input: {
  requestType: PrivacyRequestType;
  jurisdiction?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const days = input.jurisdiction === "ccpa_cpra" ? 45 : 30;
  return addDays(now, input.requestType === "opt_out_sale_share" ? 15 : days).toISOString();
}

export function buildPrivacyRequestRow(input: PrivacyRequestInput) {
  const requestType = normalizePrivacyRequestType(input.requestType);
  const jurisdiction = normalizeJurisdiction(input.jurisdiction);
  const now = input.now ?? new Date();
  const gpcSignal = readBoolean(input.gpcSignal);
  const doNotSellShare = gpcSignal || readBoolean(input.doNotSellShare);

  return {
    user_id: input.userId,
    request_type: requestType,
    status: "submitted",
    jurisdiction,
    due_at: privacyRequestDueAt({ requestType, jurisdiction, now }),
    verification_status: "authenticated",
    gpc_signal: gpcSignal,
    do_not_sell_share: doNotSellShare,
    limit_sensitive_data: readBoolean(input.limitSensitiveData),
    details: {
      message: readString(input.message),
      legalBasis: privacyLegalBasis(requestType),
      submittedAt: now.toISOString(),
      noSaleShareDefault: DO_NOT_SELL_OR_SHARE_DEFAULT,
    },
  };
}

export function buildLegalRequestRow(input: LegalRequestInput) {
  const now = input.now ?? new Date();
  const requester = readString(input.requester);
  const requesterEmail = normalizeEmail(input.requesterEmail);
  const jurisdiction = normalizeJurisdiction(input.jurisdiction);
  if (requester.length < 2 && requesterEmail === null) {
    throw new Error("Legal request requester or requester email is required.");
  }
  if (readString(input.description ?? input.statement).length < 12) {
    throw new Error("Legal request details are required.");
  }

  return {
    requester: requester || requesterEmail || "anonymous",
    requester_email: requesterEmail,
    request_type: input.requestType,
    target_type: normalizeOptionalText(input.targetType),
    target_id: normalizeUuid(input.targetId),
    status: "received",
    jurisdiction,
    legal_hold: legalRequestNeedsHold(input.requestType),
    due_at: legalRequestDueAt({ requestType: input.requestType, now }).toISOString(),
    source: readString(input.source) || "public_intake",
    priority: legalRequestPriority(input.requestType),
    notice_category: input.requestType,
    target_url: normalizeOptionalText(input.targetUrl),
    child_safety_escalation:
      input.requestType === "child_safety_escalation" || input.requestType === "underage_report",
    details: {
      description: readString(input.description),
      statement: readString(input.statement),
      signature: readString(input.signature),
      receiptRequired: true,
      decisionNotificationRequired: true,
      statementOfReasonsRequired:
        input.requestType === "dsa_notice" || input.requestType === "osa_illegal_content",
    },
  };
}

export function buildTransparencyEventRow(input: {
  eventType: string;
  subjectType?: string | null;
  subjectId?: string | null;
  publicBucket: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}) {
  return {
    event_type: input.eventType,
    subject_type: input.subjectType ?? null,
    subject_id: normalizeUuid(input.subjectId),
    public_bucket: input.publicBucket,
    count_delta: 1,
    metadata: {
      privacyPreservingAggregate: true,
      ...(input.metadata ?? {}),
    },
    is_public: true,
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
  };
}

export function normalizeCookieConsent(input: {
  categories?: Record<string, unknown>;
  gpcSignal?: boolean;
  now?: Date;
}) {
  const categories = input.categories ?? {};
  const gpcSignal = input.gpcSignal === true;
  return {
    strictly_necessary: true,
    analytics: gpcSignal ? false : readBoolean(categories.analytics),
    marketing: false,
    gpc_signal: gpcSignal,
    do_not_sell_share: true,
    behavioral_advertising: BEHAVIORAL_ADVERTISING_AT_LAUNCH,
    vendors: COOKIE_CATEGORIES,
    updated_at: (input.now ?? new Date()).toISOString(),
  };
}

export function buildAiMetadata(input: AiMetadataInput) {
  return {
    modelProvider: readString(input.modelProvider),
    modelName: readString(input.modelName),
    modelLicense: readString(input.modelLicense),
    trainingDataSummary: readString(input.trainingDataSummary),
    intendedUse: readString(input.intendedUse),
    limitations: readString(input.limitations),
    evaluationResults: readString(input.evaluationResults),
    knownRisks: readString(input.knownRisks),
    responsibleDisclosureStatus: readString(input.responsibleDisclosureStatus),
    exportControlNoticeAccepted: readBoolean(input.exportControlNoticeAccepted),
  };
}

export function validateAiMetadata(input: ReturnType<typeof buildAiMetadata>) {
  const missing = Object.entries(input)
    .filter(([key, value]) => {
      if (key === "exportControlNoticeAccepted") {
        return value !== true;
      }
      return typeof value === "string" && value.length === 0;
    })
    .map(([key]) => key);
  return {
    ok: missing.length === 0,
    missing,
  };
}

function legalRequestDueAt(input: { requestType: LegalRequestType; now: Date }) {
  const days =
    input.requestType === "child_safety_escalation"
      ? 1
      : input.requestType === "dsa_notice" || input.requestType === "osa_illegal_content"
        ? 7
        : 14;
  return addDays(input.now, days);
}

function legalRequestNeedsHold(type: LegalRequestType) {
  return type === "dmca_takedown" || type === "law_enforcement" || type === "privacy_regulator";
}

function legalRequestPriority(type: LegalRequestType) {
  if (type === "child_safety_escalation") {
    return "critical";
  }
  if (type === "underage_report" || type === "osa_illegal_content" || type === "dsa_notice") {
    return "high";
  }
  return "normal";
}

function privacyLegalBasis(type: PrivacyRequestType) {
  switch (type) {
    case "export":
      return "access_portability";
    case "delete":
      return "erasure";
    case "rectify":
      return "rectification";
    case "restrict_processing":
      return "restriction";
    case "objection":
      return "objection";
    case "opt_out_sale_share":
      return "ccpa_cpra_opt_out_gpc";
    case "limit_sensitive_data":
      return "limit_sensitive_personal_information";
    case "automated_decision_review":
      return "automated_decision_review";
  }
}

function policy(
  slug: LegalPolicySlug,
  title: string,
  summary: string,
  sections: LegalPolicyPage["sections"],
): LegalPolicyPage {
  return {
    slug,
    title,
    version: "2026-06-12.phase18",
    updatedAt: "2026-06-12",
    summary,
    sections,
  };
}

function section(heading: string, body: readonly string[]) {
  return { heading, body };
}

function record(key: string, purpose: string, legalBasis: string) {
  return { key, purpose, legalBasis };
}

function vendor(name: string, purpose: string, dpaStatus: string) {
  return { name, purpose, dpaStatus };
}

function retention(key: string, rule: string) {
  return { key, rule };
}

function normalizeJurisdiction(value: unknown): string {
  const text = readString(value).toLowerCase();
  if (["gdpr", "uk_gdpr", "ccpa_cpra", "dsa", "osa", "dmca", "platform"].includes(text)) {
    return text;
  }
  return "platform";
}

function normalizeEmail(value: unknown): string | null {
  const text = readString(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
}

function normalizeOptionalText(value: unknown): string | null {
  const text = readString(value);
  return text.length > 0 ? text : null;
}

function normalizeUuid(value: unknown): string | null {
  const text = readString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
