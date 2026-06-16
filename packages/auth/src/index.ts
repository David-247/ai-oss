import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type { SupabaseClient } from "@supabase/supabase-js";

export const PACKAGE_NAME = "@ai-oss/auth" as const;

export const REQUIRED_CONSENT_POLICIES = [
  "terms",
  "privacy",
  "community_guidelines",
  "research_publishing",
  "cookie_policy",
] as const;

export type ConsentPolicyKey = (typeof REQUIRED_CONSENT_POLICIES)[number];

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
  configured: boolean;
}

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
  configured: boolean;
}

export interface SignupInput {
  email: string;
  password?: string;
  passwordless?: boolean;
  username: string;
  displayName?: string;
  bio?: string;
  ageAttested: boolean;
  consents: Record<ConsentPolicyKey, string>;
}

export interface ProfileUpdateInput {
  username?: string;
  displayName?: string;
  bio?: string;
  websiteUrl?: string;
  githubUsername?: string;
  orcid?: string;
  affiliation?: string;
  researchInterests?: string[];
  profileVisibility?: "public" | "authenticated" | "private";
  emailVisibility?: "public" | "authenticated" | "private";
  contactPermission?: "everyone" | "members" | "none";
  searchIndexingEnabled?: boolean;
  donorBadgeVisible?: boolean;
}

export interface PrivacySettingsInput {
  analyticsConsent?: boolean;
  cookieConsent?: Record<string, boolean>;
  notificationPreferences?: Record<string, boolean | string>;
  visibility?: Record<string, string>;
  emailDigestFrequency?: "never" | "daily" | "weekly" | "monthly";
  publicDonorBadgeOptIn?: boolean;
  dmPermissions?: "everyone" | "members" | "none";
}

export interface ConsentEventInsert {
  user_id: string;
  policy_key: ConsentPolicyKey;
  policy_version: string;
  accepted: boolean;
  age_attested: boolean;
  metadata: {
    source: "signup";
    email: string;
  };
}

export interface PrivacyExportInput {
  profile: unknown;
  settings: unknown;
  zoneMemberships: unknown[];
  posts: unknown[];
  comments: unknown[];
  papers: unknown[];
  reviews: unknown[];
  replicationReports: unknown[];
  votes: unknown[];
  moderationHistory: unknown[];
  donations: unknown[];
  consentEvents: unknown[];
}

export interface PrivacyExportDocument extends PrivacyExportInput {
  exportedAt: string;
  formatVersion: "2026-06-12.phase03.v1";
}

export interface AccountDeletionPlanInput {
  userId: string;
  requestedAt: string;
  hasLegalHold: boolean;
  publicPosts: number;
  publicComments: number;
  publishedPapers: number;
  privateChatMessages: number;
}

export interface AccountDeletionPlan {
  userId: string;
  requestedAt: string;
  revokeSessions: true;
  queueWorkflow: "account_deletion_anonymization";
  profileAction: "anonymize";
  publicContentAction: "soft_delete_or_anonymize";
  privateDataAction: "delete_or_anonymize";
  researchAction: "withdraw_redact_or_pseudonymize_never_destroy_versions";
  legalHoldAction: "preserve_required_records";
  auditEventRequired: true;
  affectedCounts: {
    publicPosts: number;
    publicComments: number;
    publishedPapers: number;
    privateChatMessages: number;
  };
}

export function getSupabasePublicConfig(
  env: Record<string, string | undefined>,
): SupabasePublicConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return {
    url,
    anonKey,
    configured: url.length > 0 && anonKey.length > 0,
  };
}

export function getSupabaseServiceConfig(
  env: Record<string, string | undefined>,
): SupabaseServiceConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    url,
    serviceRoleKey,
    configured: url.length > 0 && serviceRoleKey.length > 0,
  };
}

export function createSupabaseAnonClient(config: SupabasePublicConfig): SupabaseClient {
  if (!config.configured) {
    throw new Error("Supabase public auth config is missing.");
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseServiceClient(config: SupabaseServiceConfig): SupabaseClient {
  if (!config.configured) {
    throw new Error("Supabase service-role config is missing.");
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function validateSignupInput(
  input: unknown,
): { ok: true; data: SignupInput } | { ok: false; issues: string[] } {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, issues: ["Expected an object."] };
  }

  const email = readString(input.email);
  const password = readOptionalString(input.password);
  const passwordless = input.passwordless === true;
  const username = readString(input.username);
  const displayName = readOptionalString(input.displayName);
  const bio = readOptionalString(input.bio);
  const ageAttested = input.ageAttested === true;

  if (!email.includes("@")) {
    issues.push("A valid email is required.");
  }
  if (!passwordless && (password === undefined || password.length < 8)) {
    issues.push("Password auth requires a password of at least 8 characters.");
  }
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,31}$/.test(username)) {
    issues.push("Username must be 3-32 characters and URL-safe.");
  }
  if (!ageAttested) {
    issues.push("Age attestation is required.");
  }

  const consents = readConsentVersions(input.consents);
  for (const policy of REQUIRED_CONSENT_POLICIES) {
    if (consents[policy] === undefined) {
      issues.push(`Missing consent for ${policy}.`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      email,
      password,
      passwordless,
      username,
      displayName,
      bio,
      ageAttested,
      consents: consents as Record<ConsentPolicyKey, string>,
    },
  };
}

export function buildConsentEvents(userId: string, signup: SignupInput): ConsentEventInsert[] {
  return REQUIRED_CONSENT_POLICIES.map((policy) => ({
    user_id: userId,
    policy_key: policy,
    policy_version: signup.consents[policy],
    accepted: true,
    age_attested: signup.ageAttested,
    metadata: {
      source: "signup",
      email: signup.email,
    },
  }));
}

export function sanitizeProfileUpdate(input: unknown): ProfileUpdateInput {
  if (!isRecord(input)) {
    return {};
  }

  return removeUndefined({
    username: readOptionalString(input.username),
    displayName: readOptionalString(input.displayName),
    bio: readOptionalString(input.bio),
    websiteUrl: readOptionalString(input.websiteUrl),
    githubUsername: readOptionalString(input.githubUsername),
    orcid: readOptionalString(input.orcid),
    affiliation: readOptionalString(input.affiliation),
    researchInterests: readStringArray(input.researchInterests),
    profileVisibility: readEnum(input.profileVisibility, ["public", "authenticated", "private"]),
    emailVisibility: readEnum(input.emailVisibility, ["public", "authenticated", "private"]),
    contactPermission: readEnum(input.contactPermission, ["everyone", "members", "none"]),
    searchIndexingEnabled: readOptionalBoolean(input.searchIndexingEnabled),
    donorBadgeVisible: readOptionalBoolean(input.donorBadgeVisible),
  });
}

export function sanitizePrivacySettings(input: unknown): PrivacySettingsInput {
  if (!isRecord(input)) {
    return {};
  }

  return removeUndefined({
    analyticsConsent: readOptionalBoolean(input.analyticsConsent),
    cookieConsent: readBooleanMap(input.cookieConsent),
    notificationPreferences: readPreferenceMap(input.notificationPreferences),
    visibility: readStringMap(input.visibility),
    emailDigestFrequency: readEnum(input.emailDigestFrequency, [
      "never",
      "daily",
      "weekly",
      "monthly",
    ]),
    publicDonorBadgeOptIn: readOptionalBoolean(input.publicDonorBadgeOptIn),
    dmPermissions: readEnum(input.dmPermissions, ["everyone", "members", "none"]),
  });
}

export function serializePrivacyExport(
  input: PrivacyExportInput,
  exportedAt = new Date().toISOString(),
): PrivacyExportDocument {
  return {
    formatVersion: "2026-06-12.phase03.v1",
    exportedAt,
    profile: input.profile,
    settings: input.settings,
    zoneMemberships: input.zoneMemberships,
    posts: input.posts,
    comments: input.comments,
    papers: input.papers,
    reviews: input.reviews,
    replicationReports: input.replicationReports,
    votes: input.votes,
    moderationHistory: input.moderationHistory,
    donations: input.donations,
    consentEvents: input.consentEvents,
  };
}

export function buildAccountDeletionPlan(input: AccountDeletionPlanInput): AccountDeletionPlan {
  return {
    userId: input.userId,
    requestedAt: input.requestedAt,
    revokeSessions: true,
    queueWorkflow: "account_deletion_anonymization",
    profileAction: "anonymize",
    publicContentAction: "soft_delete_or_anonymize",
    privateDataAction: "delete_or_anonymize",
    researchAction: "withdraw_redact_or_pseudonymize_never_destroy_versions",
    legalHoldAction: input.hasLegalHold ? "preserve_required_records" : "preserve_required_records",
    auditEventRequired: true,
    affectedCounts: {
      publicPosts: input.publicPosts,
      publicComments: input.publicComments,
      publishedPapers: input.publishedPapers,
      privateChatMessages: input.privateChatMessages,
    },
  };
}

function readConsentVersions(value: unknown): Partial<Record<ConsentPolicyKey, string>> {
  if (!isRecord(value)) {
    return {};
  }

  const consents: Partial<Record<ConsentPolicyKey, string>> = {};
  for (const policy of REQUIRED_CONSENT_POLICIES) {
    const version = readOptionalString(value[policy]);
    if (version !== undefined) {
      consents[policy] = version;
    }
  }
  return consents;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text.length > 0 ? text : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value
    .map((item) => readOptionalString(item))
    .filter((item): item is string => item !== undefined);
  return strings.length > 0 ? strings : undefined;
}

function readBooleanMap(value: unknown): Record<string, boolean> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const output: Record<string, boolean> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (typeof setting === "boolean") {
      output[key] = setting;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function readPreferenceMap(value: unknown): Record<string, boolean | string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const output: Record<string, boolean | string> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (typeof setting === "boolean" || typeof setting === "string") {
      output[key] = setting;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function readStringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const output: Record<string, string> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (typeof setting === "string" && setting.length > 0) {
      output[key] = setting;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function readEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
