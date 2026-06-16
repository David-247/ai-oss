import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const supabaseRoot = join(repoRoot, "supabase");

const migrationFiles = listSqlFiles(join(supabaseRoot, "migrations"));
const policyFiles = listSqlFiles(join(supabaseRoot, "policies"));
const seedFiles = listSqlFiles(join(supabaseRoot, "seed"));

const migrationSql = readSqlFiles(migrationFiles);
const phaseSql = readSqlFiles([...migrationFiles, ...policyFiles]);
const seedSql = readSqlFiles(seedFiles);

const normalizedPhaseSql = normalizeSql(phaseSql);
const policies = parsePolicies(phaseSql);

const SECTION_19_TABLES = [
  "profiles",
  "user_settings",
  "user_security_state",
  "consent_events",
  "roles",
  "role_bindings",
  "permission_audit",
  "zones",
  "zone_members",
  "zone_flairs",
  "zone_wiki_pages",
  "zone_settings",
  "zone_governance_settings",
  "posts",
  "comments",
  "votes",
  "papers",
  "paper_versions",
  "paper_authors",
  "paper_files",
  "paper_links",
  "paper_reviews",
  "replication_reports",
  "chat_rooms",
  "chat_room_members",
  "chat_messages",
  "voice_rooms",
  "voice_participants",
  "reports",
  "moderation_actions",
  "appeals",
  "automod_rules",
  "automod_runs",
  "mod_removal_petitions",
  "mod_removal_petition_support",
  "governance_votes",
  "governance_ballots",
  "files",
  "search_documents",
  "donations",
  "stripe_events",
  "audit_events",
  "privacy_requests",
  "legal_requests",
  "transparency_report_events",
] as const;

// Tables that should have direct client/user access guarded by RLS policies.
// Admin-only and security-sensitive tables are verified separately against broad
// client update policies.
const USER_ACCESSIBLE_TABLES = [
  "profiles",
  "user_settings",
  "consent_events",
  "zones",
  "zone_members",
  "zone_flairs",
  "zone_wiki_pages",
  "zone_settings",
  "posts",
  "comments",
  "votes",
  "papers",
  "paper_versions",
  "paper_authors",
  "paper_files",
  "paper_links",
  "paper_reviews",
  "replication_reports",
  "chat_rooms",
  "chat_room_members",
  "chat_messages",
  "voice_rooms",
  "voice_participants",
  "reports",
  "appeals",
  "mod_removal_petitions",
  "mod_removal_petition_support",
  "governance_votes",
  "governance_ballots",
  "files",
  "search_documents",
  "donations",
  "privacy_requests",
] as const;

const PROTECTED_UPDATE_TABLES = [
  "roles",
  "role_bindings",
  "permission_audit",
  "user_security_state",
  "moderation_actions",
  "automod_rules",
  "automod_runs",
  "governance_ballots",
  "donations",
  "stripe_events",
  "audit_events",
  "legal_requests",
  "transparency_report_events",
] as const;

const PROTECTED_UPDATE_COLUMNS = [
  "trust_score",
  "reputation_score",
  "certification_status",
  "certified_at",
  "certified_by",
  "moderation_status",
  "moderation_state",
  "payment_status",
  "stripe_customer_id",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "refunded_at",
] as const;

const REQUIRED_SYSTEM_ROLES = [
  ["owner"],
  ["super admin", "super_admin"],
  ["trust safety admin", "trust and safety admin", "trust_safety_admin"],
  ["legal admin", "legal_admin"],
  ["privacy admin", "privacy_admin", "dpo"],
  ["security admin", "security_admin"],
  ["finance admin", "finance_admin"],
  ["support admin", "support_admin"],
  ["research admin", "research_admin"],
  ["zone admin", "zone_admin"],
  ["read only auditor", "read_only_auditor", "readonly auditor"],
] as const;

type Policy = {
  command: "all" | "select" | "insert" | "update" | "delete";
  roles: string[];
  statement: string;
  table: string;
};

describe("Phase 01 data architecture static SQL", () => {
  it("creates every table listed in Section 19", () => {
    const missing = SECTION_19_TABLES.filter(
      (table) => findCreateTableBody(migrationSql, table) === null,
    );

    expect(missing, `missing CREATE TABLE statements: ${missing.join(", ")}`).toEqual([]);
  });

  it("enforces the required user/content uniqueness constraints", () => {
    expect(
      hasUniqueColumns("votes", ["user_id", "target_type", "target_id"]),
      "votes must be unique by user_id + target_type + target_id",
    ).toBe(true);

    expect(
      hasUniqueColumns("paper_versions", ["paper_id", "version_number"]),
      "paper_versions must be unique by paper_id + version_number",
    ).toBe(true);
  });

  it("defines search_documents for full-text, vector, and visibility-filtered reads", () => {
    const body = findCreateTableBody(migrationSql, "search_documents");

    expect(body, "search_documents table is missing").not.toBeNull();
    expect(hasColumnType(body, "tsv", "(?:public\\.)?tsvector\\b")).toBe(true);
    expect(hasColumnType(body, "embedding", "(?:public\\.)?vector(?:\\s*\\(|\\b)")).toBe(true);
    expect(hasPolicy("search_documents", "select", /\bvisibility\b/)).toBe(true);
  });

  it("keeps voice recording and transcription disabled by default", () => {
    const body = findCreateTableBody(migrationSql, "voice_rooms");

    expect(body, "voice_rooms table is missing").not.toBeNull();
    expect(hasDefaultFalseColumn(body, "recording")).toBe(true);
    expect(hasDefaultFalseColumn(body, "transcription")).toBe(true);
  });

  it("enables RLS and defines policies for user-accessible tables", () => {
    const missingRls = USER_ACCESSIBLE_TABLES.filter((table) => !hasRlsEnabled(table));
    const missingPolicies = USER_ACCESSIBLE_TABLES.filter((table) => !hasAnyPolicy(table));

    expect(
      missingRls,
      `tables without ENABLE ROW LEVEL SECURITY: ${missingRls.join(", ")}`,
    ).toEqual([]);
    expect(missingPolicies, `tables without CREATE POLICY: ${missingPolicies.join(", ")}`).toEqual(
      [],
    );
  });

  it("does not grant broad client update policies over protected tables or columns", () => {
    const protectedTables = new Set<string>(PROTECTED_UPDATE_TABLES);

    for (const table of SECTION_19_TABLES) {
      const body = findCreateTableBody(migrationSql, table);
      if (body !== null && hasProtectedColumn(body)) {
        protectedTables.add(table);
      }
    }

    const broadPolicies = policies
      .filter((policy) => protectedTables.has(policy.table))
      .filter((policy) => policy.command === "update" || policy.command === "all")
      .filter((policy) => grantsClientRole(policy))
      .filter((policy) => isBroadUpdatePolicy(policy.statement))
      .map((policy) => `${policy.table}: ${policy.statement}`);

    expect(
      broadPolicies,
      `broad protected client update policies: ${broadPolicies.join(" | ")}`,
    ).toEqual([]);
  });

  it("represents required system roles when seed SQL exists", () => {
    if (seedFiles.length === 0) {
      return;
    }

    const canonicalSeedSql = canonicalizeRoleText(seedSql);
    const missingRoles = REQUIRED_SYSTEM_ROLES.filter(
      (variants) =>
        !variants.some((variant) => canonicalSeedSql.includes(canonicalizeRoleText(variant))),
    ).map((variants) => variants[0]);

    expect(missingRoles, `missing seed roles: ${missingRoles.join(", ")}`).toEqual([]);
  });
});

function listSqlFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSqlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".sql")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function readSqlFiles(files: string[]): string {
  return files.map((file) => readFileSync(file, "utf8")).join("\n\n");
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
}

function normalizeSql(sql: string): string {
  return stripSqlComments(sql).toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function identifierPattern(identifier: string): string {
  const escaped = escapeRegExp(identifier);
  return `(?:"${escaped}"|${escaped})`;
}

function qualifiedTablePattern(table: string): string {
  return `(?:(?:"public"|public)\\s*\\.\\s*)?${identifierPattern(table)}`;
}

function findCreateTableBody(sql: string, table: string): string | null {
  const source = stripSqlComments(sql).toLowerCase();
  const pattern = new RegExp(
    `\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${qualifiedTablePattern(table)}\\s*\\(`,
  );
  const match = pattern.exec(source);

  if (match === null) {
    return null;
  }

  const openParenIndex = source.indexOf("(", match.index + match[0].length - 1);
  if (openParenIndex === -1) {
    return null;
  }

  const closeParenIndex = findMatchingParen(source, openParenIndex);
  if (closeParenIndex === -1) {
    return null;
  }

  return source.slice(openParenIndex + 1, closeParenIndex);
}

function findMatchingParen(sql: string, openParenIndex: number): number {
  let depth = 0;

  for (let index = openParenIndex; index < sql.length; index += 1) {
    const char = sql[index];

    if (char === "'") {
      index = skipQuoted(sql, index, "'");
      continue;
    }

    if (char === '"') {
      index = skipQuoted(sql, index, '"');
      continue;
    }

    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function skipQuoted(sql: string, quoteIndex: number, quote: "'" | '"'): number {
  for (let index = quoteIndex + 1; index < sql.length; index += 1) {
    if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 1;
        continue;
      }

      return index;
    }
  }

  return sql.length - 1;
}

function hasUniqueColumns(table: string, expectedColumns: readonly string[]): boolean {
  const body = findCreateTableBody(migrationSql, table);

  if (body !== null) {
    for (const match of body.matchAll(/\bunique\b(?:\s+nulls\s+not\s+distinct)?\s*\(([^)]*)\)/g)) {
      if (sameColumns(parseColumnList(match[1] ?? ""), expectedColumns)) {
        return true;
      }
    }
  }

  return sqlStatements(migrationSql).some((statement) => {
    if (!/\bcreate\s+unique\s+index\b/.test(statement)) {
      return false;
    }

    const pattern = new RegExp(
      `\\bon\\s+${qualifiedTablePattern(table)}\\s+(?:using\\s+[a-z0-9_]+\\s+)?\\(([^)]*)\\)`,
    );
    const match = pattern.exec(statement);

    return match !== null && sameColumns(parseColumnList(match[1] ?? ""), expectedColumns);
  });
}

function parseColumnList(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => {
      const match = part
        .trim()
        .replace(/"/g, "")
        .match(/^(?:public\.)?([a-z_][a-z0-9_]*)/);

      return match?.[1] ?? "";
    })
    .filter((column) => column.length > 0);
}

function sameColumns(actual: string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  const actualSet = new Set(actual);
  return expected.every((column) => actualSet.has(column));
}

function hasColumnType(body: string | null, column: string, typePattern: string): boolean {
  if (body === null) {
    return false;
  }

  const pattern = new RegExp(`(?:^|[,\\s])${identifierPattern(column)}\\s+${typePattern}`, "i");
  return pattern.test(body);
}

function hasDefaultFalseColumn(body: string | null, columnNameFragment: string): boolean {
  if (body === null) {
    return false;
  }

  const pattern = new RegExp(
    `\\b[a-z_]*${escapeRegExp(columnNameFragment)}[a-z_]*\\b\\s+(?:bool|boolean)\\b[^,]*\\bdefault\\s+\\(?\\s*false\\s*\\)?`,
    "i",
  );
  return pattern.test(body);
}

function hasRlsEnabled(table: string): boolean {
  const pattern = new RegExp(
    `\\balter\\s+table\\s+(?:only\\s+)?${qualifiedTablePattern(table)}\\s+enable\\s+row\\s+level\\s+security\\b`,
  );

  return pattern.test(normalizedPhaseSql);
}

function hasAnyPolicy(table: string): boolean {
  return policies.some((policy) => policy.table === table);
}

function hasPolicy(table: string, command: Policy["command"], requiredPattern: RegExp): boolean {
  return policies.some(
    (policy) =>
      policy.table === table &&
      (policy.command === command || policy.command === "all") &&
      requiredPattern.test(policy.statement),
  );
}

function parsePolicies(sql: string): Policy[] {
  return sqlStatements(sql)
    .map((statement): Policy | null => {
      if (!/\bcreate\s+policy\b/.test(statement)) {
        return null;
      }

      const tableMatch = statement.match(
        /\bon\s+(?:(?:"public"|public)\s*\.\s*)?(?:"([a-z_][a-z0-9_]*)"|([a-z_][a-z0-9_]*))\b/,
      );
      const table = tableMatch?.[1] ?? tableMatch?.[2];

      if (table === undefined) {
        return null;
      }

      const commandMatch = statement.match(/\bfor\s+(all|select|insert|update|delete)\b/);
      const command = (commandMatch?.[1] ?? "all") as Policy["command"];
      const rolesMatch = statement.match(/\bto\s+(.+?)(?=\s+(?:using|with\s+check|for|as)\b|$)/);
      const rawRoles = rolesMatch?.[1];
      const roles =
        rawRoles === undefined
          ? ["public"]
          : rawRoles
              .split(",")
              .map((role) => role.trim().replace(/"/g, ""))
              .filter((role) => role.length > 0);

      return { command, roles, statement, table };
    })
    .filter((policy): policy is Policy => policy !== null);
}

function sqlStatements(sql: string): string[] {
  return stripSqlComments(sql)
    .split(";")
    .map(normalizeSql)
    .filter((statement) => statement.length > 0);
}

function grantsClientRole(policy: Policy): boolean {
  const clientRoles = new Set(["public", "anon", "authenticated"]);
  return policy.roles.some((role) => clientRoles.has(role));
}

function isBroadUpdatePolicy(statement: string): boolean {
  const hasUsing = /\busing\s*\(/.test(statement);
  const hasCheck = /\bwith\s+check\s*\(/.test(statement);
  const truePredicate = /\b(?:using|with\s+check)\s*\(\s*\(?\s*true\s*\)?\s*\)/.test(statement);

  return truePredicate || (!hasUsing && !hasCheck);
}

function hasProtectedColumn(body: string): boolean {
  return PROTECTED_UPDATE_COLUMNS.some((column) => {
    const pattern = new RegExp(`(?:^|[,\\s])${identifierPattern(column)}\\s+`, "i");
    return pattern.test(body);
  });
}

function canonicalizeRoleText(value: string): string {
  return normalizeSql(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s*&\s*/g, " ")
    .replace(/\s+/g, " ");
}
