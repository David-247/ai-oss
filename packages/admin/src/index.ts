export const PACKAGE_NAME = "@ai-oss/admin" as const;

export type AdminPanelKey =
  | "overview"
  | "users"
  | "roles"
  | "zones"
  | "content"
  | "reports"
  | "moderation"
  | "research"
  | "automod"
  | "appeals"
  | "legal"
  | "privacy-requests"
  | "security"
  | "donations"
  | "analytics"
  | "audit-log"
  | "system";

export interface AdminPanelDefinition {
  key: AdminPanelKey;
  path: string;
  title: string;
  permission: string;
  checklist: readonly string[];
  widgets: readonly string[];
  tables: readonly string[];
}

export const ADMIN_HOME_WIDGETS = [
  "System health",
  "Pending reports",
  "Pending appeals",
  "Quarantined papers",
  "Abuse spikes",
  "New-user growth",
  "Active zones",
  "Donation summary",
  "Cost dashboard",
  "Security alerts",
  "Privacy/legal deadlines",
  "Recent admin actions",
  "Background job failures",
] as const;

export const ADMIN_PANELS = [
  panel("overview", "/admin", "Admin Home", "audit.read", ADMIN_HOME_WIDGETS, [
    "audit_events",
    "reports",
    "appeals",
    "papers",
    "abuse_rate_limit_events",
    "alert_events",
    "observability_events",
    "system_health_snapshots",
    "jobs",
    "donations",
  ]),
  panel(
    "users",
    "/admin/users",
    "User Administration",
    "users.read",
    [
      "Search users",
      "Profile/account status",
      "Sessions and linked OAuth",
      "Trust score and security state",
      "Reports and moderation history",
      "Suspend, ban, revoke sessions, force reset",
      "Deletion/export status",
      "Consent records",
      "Assign/revoke roles",
      "Internal notes",
      "Privacy export/deletion triggers",
    ],
    ["profiles", "user_security_state", "role_bindings", "consent_events", "audit_events"],
  ),
  panel(
    "roles",
    "/admin/roles",
    "Role Administration",
    "roles.read",
    [
      "Global role list",
      "Custom role builder",
      "Permission matrix",
      "Role assignment",
      "Expiring assignments",
      "Two-person approval for high-risk roles",
      "Role audit history",
    ],
    ["roles", "role_bindings", "permission_audit", "audit_events"],
  ),
  panel(
    "zones",
    "/admin/zones",
    "Zone Administration",
    "zones.read",
    [
      "Zone search",
      "Status and owner/mod list",
      "Rules and AutoMod status",
      "Reports and growth/abuse metrics",
      "Quarantine, transfer, remove, lock",
      "Emergency read-only mode",
      "Community mod-removal override",
    ],
    ["zones", "zone_members", "zone_settings", "automod_rules", "mod_removal_petitions"],
  ),
  panel(
    "content",
    "/admin/content",
    "Content Moderation",
    "moderation.read",
    [
      "Unified content queue",
      "Filter by zone/type/severity/reason/rule/date",
      "Bulk actions",
      "Single-item context",
      "User and conversation history",
      "Remove, approve, lock, restore",
      "Escalate to legal/security",
      "Reporter and author notifications",
      "Appealable decisions",
      "DSA/OSA statement of reasons",
    ],
    ["reports", "moderation_actions", "posts", "comments", "chat_messages", "files"],
  ),
  panel(
    "reports",
    "/admin/reports",
    "Reports",
    "moderation.read",
    [
      "Report inbox",
      "Severity and reason filters",
      "Target context",
      "Reporter reply",
      "Author notification",
      "Escalation routing",
    ],
    ["reports", "moderation_actions"],
  ),
  panel(
    "moderation",
    "/admin/moderation",
    "Moderation Operations",
    "moderation.read",
    [
      "Queue triage",
      "Bulk moderation actions",
      "Action history",
      "Appealable decision creation",
      "Legal/security escalation",
    ],
    ["reports", "moderation_actions", "appeals"],
  ),
  panel(
    "research",
    "/admin/research",
    "Research Administration",
    "research.read",
    [
      "Paper search",
      "Pending automated scans",
      "Quarantined papers",
      "Metadata correction",
      "Version audit",
      "File scan and license state",
      "Takedown and withdrawal tools",
      "Safety flags",
      "Reviewer abuse reports",
      "Public status reason",
    ],
    ["papers", "paper_versions", "paper_files", "paper_reviews", "replication_reports"],
  ),
  panel(
    "automod",
    "/admin/automod",
    "AutoMod Administration",
    "moderation.automod_manage",
    [
      "Global and zone rules",
      "Rule editor",
      "YAML/JSON import and export",
      "Validation and simulator",
      "Dry-run",
      "Version history",
      "Publish and rollback workflow",
      "Performance metrics",
      "Rule hit log",
    ],
    ["automod_rules", "automod_runs"],
  ),
  panel(
    "appeals",
    "/admin/appeals",
    "Appeals Administration",
    "moderation.read",
    [
      "Appeal inbox",
      "Original decision and reason",
      "User appeal text",
      "Content context",
      "Applicable policy",
      "Prior actions",
      "Uphold, reverse, modify, escalate",
      "Response templates",
      "Audit trail",
      "DSA/OSA-compatible handling",
    ],
    ["appeals", "moderation_actions", "audit_events"],
  ),
  panel(
    "legal",
    "/admin/legal",
    "Legal Administration",
    "legal.read",
    [
      "DMCA and counter-notices",
      "Repeat-infringer records",
      "DSA notices",
      "OSA risk records",
      "Law-enforcement requests",
      "Preservation and legal holds",
      "Retention schedules",
      "Transparency report exports",
    ],
    ["legal_requests", "audit_events", "consent_events"],
  ),
  panel(
    "privacy-requests",
    "/admin/privacy-requests",
    "Privacy Requests",
    "privacy.read",
    [
      "User privacy requests",
      "Data exports",
      "Account deletion jobs",
      "Consent logs",
      "Cookie consent logs",
      "Retention schedules",
      "DPO audit trail",
    ],
    ["privacy_requests", "consent_events", "audit_events"],
  ),
  panel(
    "security",
    "/admin/security",
    "Security Administration",
    "security.read",
    [
      "Suspicious logins",
      "Bot spikes",
      "Rate-limit events",
      "WAF events",
      "Vote-manipulation alerts",
      "Governance certification alerts",
      "IP/device risk clusters",
      "Admin session list",
      "Secret rotation checklist",
      "Incident runbooks",
    ],
    [
      "user_security_state",
      "security_events",
      "alert_events",
      "abuse_rate_limit_events",
      "governance_votes",
      "observability_events",
      "system_health_snapshots",
      "audit_events",
    ],
  ),
  panel(
    "donations",
    "/admin/donations",
    "Donations Administration",
    "finance.read",
    [
      "Donation list and search",
      "Stripe event log",
      "Refund and chargeback state",
      "Donor-badge opt-in",
      "Anonymous donation flag",
      "Accounting export",
      "Donor support note",
    ],
    ["donations", "stripe_events", "audit_events"],
  ),
  panel(
    "analytics",
    "/admin/analytics",
    "Analytics",
    "audit.read",
    ["Growth", "Abuse trends", "Operational volume", "Background job outcomes"],
    ["audit_events", "reports", "jobs"],
  ),
  panel(
    "audit-log",
    "/admin/audit-log",
    "Audit Log",
    "audit.read",
    ["Append-only audit log", "Actor/resource filters", "Exportable records"],
    ["audit_events", "permission_audit"],
  ),
  panel(
    "system",
    "/admin/system",
    "System",
    "system.settings_read",
    [
      "Health checks",
      "Feature flags",
      "Background job failures",
      "Secret rotation checklist",
      "Observability coverage",
      "Cost dashboard",
    ],
    ["jobs", "observability_events", "alert_events", "system_health_snapshots", "audit_events"],
  ),
] as const satisfies readonly AdminPanelDefinition[];

export type AdminActionKey =
  | "suspend_user"
  | "unsuspend_user"
  | "ban_user"
  | "revoke_sessions"
  | "force_password_reset"
  | "mark_user_review"
  | "trigger_privacy_export"
  | "trigger_account_deletion"
  | "grant_role"
  | "revoke_role"
  | "quarantine_zone"
  | "transfer_zone_ownership"
  | "remove_zone"
  | "lock_zone"
  | "emergency_readonly_zone"
  | "override_mod_removal"
  | "content_remove"
  | "content_approve"
  | "content_lock"
  | "content_restore"
  | "escalate_legal"
  | "escalate_security"
  | "decide_appeal"
  | "correct_research_metadata"
  | "quarantine_paper"
  | "withdraw_paper"
  | "automod_publish"
  | "automod_rollback"
  | "legal_hold"
  | "privacy_request_execute"
  | "rotate_secret_checklist"
  | "export_accounting"
  | "refund_donation";

export interface AdminActionDefinition {
  key: AdminActionKey;
  panel: AdminPanelKey;
  permission: string;
  highRisk: boolean;
  resourceType: string;
  audited: true;
}

export const ADMIN_ACTIONS = [
  action("suspend_user", "users", "users.suspend", true, "profile"),
  action("unsuspend_user", "users", "users.suspend", true, "profile"),
  action("ban_user", "users", "users.ban", true, "profile"),
  action("revoke_sessions", "users", "users.update_basic", true, "user_session"),
  action("force_password_reset", "users", "users.update_basic", true, "profile"),
  action("mark_user_review", "users", "users.update_basic", false, "profile"),
  action("trigger_privacy_export", "users", "users.export", true, "privacy_request"),
  action("trigger_account_deletion", "users", "users.delete_or_anonymize", true, "privacy_request"),
  action("grant_role", "roles", "roles.grant", true, "role_binding"),
  action("revoke_role", "roles", "roles.revoke", true, "role_binding"),
  action("quarantine_zone", "zones", "zones.update", true, "zone"),
  action("transfer_zone_ownership", "zones", "zones.governance_update", true, "zone"),
  action("remove_zone", "zones", "zones.delete", true, "zone"),
  action("lock_zone", "zones", "zones.update", true, "zone"),
  action("emergency_readonly_zone", "zones", "zones.update", true, "zone"),
  action("override_mod_removal", "zones", "zones.governance_update", true, "governance_vote"),
  action("content_remove", "content", "moderation.update", false, "content"),
  action("content_approve", "content", "moderation.update", false, "content"),
  action("content_lock", "content", "moderation.update", false, "content"),
  action("content_restore", "content", "moderation.update", false, "content"),
  action("escalate_legal", "content", "legal.update", false, "legal_request"),
  action("escalate_security", "content", "security.update", false, "security_event"),
  action("decide_appeal", "appeals", "moderation.update", false, "appeal"),
  action("correct_research_metadata", "research", "research.update", false, "paper"),
  action("quarantine_paper", "research", "research.update", false, "paper"),
  action("withdraw_paper", "research", "research.withdraw", true, "paper"),
  action("automod_publish", "automod", "moderation.automod_manage", true, "automod_rule"),
  action("automod_rollback", "automod", "moderation.automod_manage", true, "automod_rule"),
  action("legal_hold", "legal", "legal.update", true, "legal_request"),
  action("privacy_request_execute", "privacy-requests", "privacy.delete_execute", true, "privacy_request"),
  action("rotate_secret_checklist", "security", "security.update", true, "system_secret"),
  action("export_accounting", "donations", "finance.export", true, "donation_export"),
  action("refund_donation", "donations", "finance.refund_export", true, "donation"),
] as const satisfies readonly AdminActionDefinition[];

export function adminPanelForSection(section?: readonly string[]): AdminPanelDefinition {
  const key = sectionKey(section);
  for (const panelDefinition of ADMIN_PANELS) {
    if (panelDefinition.key === key) {
      return panelDefinition;
    }
  }
  return ADMIN_PANELS[0];
}

export function adminPanelSummaries() {
  return ADMIN_PANELS.map(({ key, path, title, permission, checklist }) => ({
    key,
    path,
    title,
    permission,
    checklistCount: checklist.length,
  }));
}

export function adminActionForKey(key: string): AdminActionDefinition | null {
  for (const adminAction of ADMIN_ACTIONS) {
    if (adminAction.key === key) {
      return adminAction;
    }
  }
  return null;
}

export function buildAdminAuditDescriptor(input: {
  panel: AdminPanelKey;
  action: AdminActionKey;
  actorId: string;
  resourceType: string;
  resourceId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.reason.trim().length < 8) {
    throw new Error("Admin actions require a reason.");
  }
  return {
    actorId: input.actorId,
    action: `admin.${input.panel}.${input.action}`,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    reason: input.reason.trim(),
    metadata: {
      serverSideOnly: true,
      audited: true,
      ...input.metadata,
    },
  };
}

export function buildStatementOfReasons(input: {
  action: string;
  policy: string;
  facts: readonly string[];
  appealable: boolean;
  jurisdiction?: "dsa" | "osa" | "platform";
}) {
  return {
    jurisdiction: input.jurisdiction ?? "platform",
    action: input.action,
    policy: input.policy,
    facts: [...input.facts],
    appealable: input.appealable,
    generatedForAdminPanel: true,
  };
}

function panel(
  key: AdminPanelKey,
  path: string,
  title: string,
  permission: string,
  checklist: readonly string[],
  tables: readonly string[],
): AdminPanelDefinition {
  return {
    key,
    path,
    title,
    permission,
    checklist,
    widgets: key === "overview" ? ADMIN_HOME_WIDGETS : checklist,
    tables,
  };
}

function action(
  key: AdminActionKey,
  panelKey: AdminPanelKey,
  permission: string,
  highRisk: boolean,
  resourceType: string,
): AdminActionDefinition {
  return { key, panel: panelKey, permission, highRisk, resourceType, audited: true };
}

function sectionKey(section?: readonly string[]): AdminPanelKey {
  const value = section?.join("/") || "overview";
  if (value === "" || value === "home") {
    return "overview";
  }
  if (value === "privacy") {
    return "privacy-requests";
  }
  if (value === "finance") {
    return "donations";
  }
  if (value === "audit") {
    return "audit-log";
  }
  if (value === "settings" || value === "feature-flags") {
    return "system";
  }
  return ADMIN_PANELS.some((panelDefinition) => panelDefinition.key === value)
    ? (value as AdminPanelKey)
    : "overview";
}
