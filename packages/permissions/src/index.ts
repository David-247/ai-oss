export const PACKAGE_NAME = "@ai-oss/permissions" as const;

export const SYSTEM_ROLE_KEYS = [
  "owner",
  "super_admin",
  "trust_safety_admin",
  "legal_admin",
  "privacy_admin_dpo",
  "security_admin",
  "finance_admin",
  "support_admin",
  "research_admin",
  "zone_admin",
  "read_only_auditor",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const PERMISSION_SCOPES = [
  "*.*",
  "users.*",
  "users.read",
  "users.update_basic",
  "users.suspend",
  "users.ban",
  "users.delete_or_anonymize",
  "users.export",
  "users.impersonate_for_support_prohibited_by_default",
  "roles.*",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
  "roles.grant",
  "roles.revoke",
  "zones.*",
  "zones.read",
  "zones.create",
  "zones.update",
  "zones.delete",
  "zones.members.read",
  "zones.members.update",
  "zones.settings_read",
  "zones.settings_update",
  "zones.governance_read",
  "zones.governance_update",
  "content.*",
  "content.read",
  "content.create",
  "content.update",
  "content.remove",
  "content.bulk_remove",
  "research.*",
  "research.read",
  "research.create",
  "research.update",
  "research.publish",
  "research.withdraw",
  "research.redact",
  "chat.*",
  "chat.read",
  "chat.create",
  "chat.update",
  "chat.moderate",
  "chat.private_export_full",
  "voice.*",
  "voice.read",
  "voice.create",
  "voice.update",
  "voice.moderate",
  "search.*",
  "search.read",
  "search.index",
  "moderation.*",
  "moderation.read",
  "moderation.update",
  "moderation.automod_manage",
  "moderation.disable_global_automod",
  "legal.*",
  "legal.read",
  "legal.update",
  "legal.purge",
  "privacy.*",
  "privacy.read",
  "privacy.update",
  "privacy.delete_execute",
  "security.*",
  "security.read",
  "security.update",
  "security.waf_bypass_update",
  "finance.*",
  "finance.read",
  "finance.update",
  "finance.export",
  "finance.refund_export",
  "audit.read",
  "audit.export",
  "system.settings_read",
  "system.settings_update",
  "feature_flags.manage",
] as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const GLOBAL_ROLE_KEYS = SYSTEM_ROLE_KEYS;

export const PERMISSION_SCOPE_CATALOG = [
  "users.*",
  "users.read",
  "users.update_basic",
  "users.suspend",
  "users.ban",
  "users.delete_or_anonymize",
  "users.export",
  "users.impersonate_for_support_prohibited_by_default",
  "roles.*",
  "zones.*",
  "content.*",
  "research.*",
  "chat.*",
  "voice.*",
  "search.*",
  "moderation.*",
  "legal.*",
  "privacy.*",
  "security.*",
  "finance.*",
  "audit.read",
  "audit.export",
  "system.settings_read",
  "system.settings_update",
  "feature_flags.manage",
] as const;

export interface RoleDefinition {
  key: SystemRoleKey | string;
  name: string;
  description: string;
  permissions: readonly PermissionScope[];
  systemRole: boolean;
}

export const SYSTEM_ROLES = {
  owner: {
    key: "owner",
    name: "Owner",
    description: "Emergency owner role with full platform authority.",
    permissions: ["*.*"],
    systemRole: true,
  },
  super_admin: {
    key: "super_admin",
    name: "Super Admin",
    description: "Full operational administration except owner emergency semantics.",
    permissions: ["*.*"],
    systemRole: true,
  },
  trust_safety_admin: {
    key: "trust_safety_admin",
    name: "Trust & Safety Admin",
    description: "Moderation, trust, safety, and anti-abuse operations.",
    permissions: [
      "users.read",
      "users.suspend",
      "users.ban",
      "content.*",
      "search.read",
      "moderation.*",
      "security.read",
      "audit.read",
    ],
    systemRole: true,
  },
  legal_admin: {
    key: "legal_admin",
    name: "Legal Admin",
    description: "Legal requests, legal holds, takedowns, and legal audit review.",
    permissions: ["users.read", "content.read", "research.read", "legal.*", "audit.read"],
    systemRole: true,
  },
  privacy_admin_dpo: {
    key: "privacy_admin_dpo",
    name: "Privacy Admin / DPO",
    description: "Privacy exports, deletion execution, and data subject requests.",
    permissions: [
      "users.read",
      "users.export",
      "users.delete_or_anonymize",
      "privacy.*",
      "audit.read",
    ],
    systemRole: true,
  },
  security_admin: {
    key: "security_admin",
    name: "Security Admin",
    description: "Security events, WAF controls, and abuse investigations.",
    permissions: ["users.read", "security.*", "audit.read", "audit.export", "system.settings_read"],
    systemRole: true,
  },
  finance_admin: {
    key: "finance_admin",
    name: "Finance Admin",
    description: "Donation/payment accounting, refunds, chargebacks, and exports.",
    permissions: ["finance.*", "audit.read"],
    systemRole: true,
  },
  support_admin: {
    key: "support_admin",
    name: "Support Admin",
    description: "User support with restricted account access and no default impersonation.",
    permissions: ["users.read", "users.update_basic", "content.read", "audit.read"],
    systemRole: true,
  },
  research_admin: {
    key: "research_admin",
    name: "Research Admin",
    description: "Research archive publishing operations and safety routing.",
    permissions: ["research.*", "content.read", "search.read", "moderation.read", "audit.read"],
    systemRole: true,
  },
  zone_admin: {
    key: "zone_admin",
    name: "Zone Admin",
    description: "Zone administration permissions, scoped by role binding zone.",
    permissions: [
      "zones.*",
      "content.*",
      "chat.*",
      "voice.*",
      "search.read",
      "moderation.read",
      "moderation.update",
    ],
    systemRole: true,
  },
  read_only_auditor: {
    key: "read_only_auditor",
    name: "Read-only Auditor",
    description: "Read-only audit and operational visibility.",
    permissions: [
      "users.read",
      "zones.read",
      "content.read",
      "research.read",
      "search.read",
      "moderation.read",
      "legal.read",
      "privacy.read",
      "security.read",
      "finance.read",
      "audit.read",
    ],
    systemRole: true,
  },
} as const satisfies Record<SystemRoleKey, RoleDefinition>;

export interface RoleBinding {
  roleKey: string;
  permissions?: readonly string[];
  zoneId?: string | null;
  expiresAt?: string | Date | null;
  revokedAt?: string | Date | null;
}

export interface ActorContext {
  id: string;
  roleBindings: readonly RoleBinding[];
  riskLevel?: "normal" | "elevated" | "restricted" | "suspended";
  mfaVerifiedAt?: string | Date | null;
  passkeyVerifiedAt?: string | Date | null;
  stepUpVerifiedAt?: string | Date | null;
  stepUpAuthenticatedAt?: string | Date | null;
  approvalActorIds?: readonly string[];
}

export interface ResourceContext {
  type?: string;
  id?: string;
  ownerId?: string | null;
  zoneId?: string | null;
  status?: string | null;
  legalHold?: boolean;
  riskLevel?: "low" | "medium" | "high" | "normal" | "elevated" | "restricted" | "suspended";
  requiresOwnership?: boolean;
}

export interface PermissionDecision {
  allowed: boolean;
  reasons: string[];
  matchedScopes: string[];
  actorRoles: string[];
}

export interface PermissionCheckInput {
  actor: ActorContext;
  scope: PermissionScope;
  resource?: ResourceContext;
  now?: Date;
}

export function checkPermission(input: PermissionCheckInput): PermissionDecision {
  const now = input.now ?? new Date();
  const actorRoles = activeRoleBindings(input.actor, now).map((binding) => binding.roleKey);
  const activeBindings = activeRoleBindings(input.actor, now);
  const matchedScopes = activeBindings.flatMap((binding) =>
    roleBindingPermissions(binding).filter((granted) => scopeMatches(granted, input.scope)),
  );
  const scopedMatchedBindings = activeBindings.filter(
    (binding) =>
      roleBindingPermissions(binding).some((granted) => scopeMatches(granted, input.scope)) &&
      bindingAppliesToResource(binding, input.resource),
  );
  const reasons: string[] = [];

  if (input.actor.riskLevel === "suspended") {
    reasons.push("actor_suspended");
  }
  if (
    input.actor.riskLevel === "restricted" &&
    isMutatingScope(input.scope) &&
    !scopeMatches("security.*", input.scope)
  ) {
    reasons.push("actor_restricted_for_mutation");
  }
  if (input.resource?.riskLevel === "suspended" && isMutatingScope(input.scope)) {
    reasons.push("resource_suspended_for_mutation");
  }
  if (input.resource?.requiresOwnership === true && input.resource.ownerId !== input.actor.id) {
    reasons.push("ownership_required");
  }
  if (matchedScopes.length > 0 && scopedMatchedBindings.length === 0) {
    reasons.push("zone_scope_mismatch");
  }
  if (
    input.resource?.legalHold === true &&
    isMutatingScope(input.scope) &&
    !scopeMatches("legal.*", input.scope)
  ) {
    reasons.push("legal_hold_requires_legal_scope");
  }
  if (
    input.resource?.status === "removed" &&
    isMutatingScope(input.scope) &&
    !scopeMatches("moderation.*", input.scope) &&
    !scopeMatches("legal.*", input.scope)
  ) {
    reasons.push("removed_resource_requires_moderation_or_legal_scope");
  }

  if (matchedScopes.length === 0) {
    reasons.push("missing_permission_scope");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    matchedScopes,
    actorRoles,
  };
}

export interface GuardResult {
  allowed: boolean;
  status?: number;
  statusCode?: number;
  reason?: string;
  requirements?: readonly string[];
}

export function requirePermission(input: PermissionCheckInput): PermissionDecision;
export function requirePermission(
  scope: string,
  resource: ResourceContext,
): (input: { actor: ActorContext; now?: Date }) => GuardResult;
export function requirePermission(
  first: PermissionCheckInput | string,
  resource?: ResourceContext,
): PermissionDecision | ((input: { actor: ActorContext; now?: Date }) => GuardResult) {
  if (typeof first !== "string") {
    return checkPermission(first);
  }

  return (input) => {
    const engine = createPermissionEngine({ now: input.now ? () => input.now as Date : undefined });
    return engine.can(input.actor, first, resource ?? {});
  };
}

export function scopeMatches(granted: string, required: PermissionScope): boolean {
  if (granted === "*.*" || granted === required) {
    return true;
  }

  if (granted.endsWith(".*")) {
    const domain = granted.slice(0, -2);
    return required === `${domain}.*` || required.startsWith(`${domain}.`);
  }

  return false;
}

export function createCustomRole(input: {
  key: string;
  name: string;
  description?: string;
  permissions: readonly PermissionScope[];
}): RoleDefinition {
  const invalid = input.permissions.filter((scope) => !isPermissionScope(scope));
  if (invalid.length > 0) {
    throw new Error(`Unknown permission scope(s): ${invalid.join(", ")}`);
  }

  return {
    key: input.key,
    name: input.name,
    description: input.description ?? "Custom role",
    permissions: [...input.permissions],
    systemRole: false,
  };
}

export const HIGH_RISK_ACTIONS = [
  "roles.grant_owner",
  "roles.revoke_owner",
  "roles.grant_super_admin",
  "roles.revoke_super_admin",
  "users.bulk_ban",
  "content.bulk_remove",
  "legal.purge",
  "chat.private_export_full",
  "privacy.delete_execute",
  "security.waf_bypass_update",
  "finance.refund_export",
  "moderation.disable_global_automod",
  "governance.vote_certification_threshold_update",
] as const;

export type HighRiskAction = (typeof HIGH_RISK_ACTIONS)[number];

export interface HighRiskDecisionInput {
  actor: ActorContext;
  action: HighRiskAction | string;
  resource?: ResourceContext;
  approvalActorIds?: readonly string[];
  ownerEmergency?: boolean;
  reason?: string;
  now?: Date;
}

export interface HighRiskDecision {
  allowed: boolean;
  requiresStepUp: boolean;
  requiresTwoPersonApproval: boolean;
  ownerEmergency: boolean;
  reasons: string[];
  reason?: string;
  requirements: string[];
  auditRequired: boolean;
}

export function evaluateHighRiskAction(input: HighRiskDecisionInput): HighRiskDecision {
  const now = input.now ?? new Date();
  const owner = actorHasRole(input.actor, "owner", now);
  const stepUp = hasRecentStepUp(input.actor, now);
  const independentApproval =
    input.approvalActorIds?.some((approverId) => approverId !== input.actor.id) ??
    input.actor.approvalActorIds?.some((approverId) => approverId !== input.actor.id) ??
    false;
  const ownerEmergency = input.ownerEmergency === true && owner;
  const reasons: string[] = [];

  if (ownerEmergency) {
    if (input.reason !== undefined && input.reason.trim().length === 0) {
      reasons.push("owner_emergency_requires_reason");
    }
    return {
      allowed: reasons.length === 0,
      requiresStepUp: false,
      requiresTwoPersonApproval: false,
      ownerEmergency: true,
      reasons,
      reason: reasons.join(", "),
      requirements: [],
      auditRequired: true,
    };
  }

  const requirements: string[] = [];
  if (!stepUp) {
    reasons.push("step_up_required");
    requirements.push("step_up_authentication");
  }
  if (!independentApproval) {
    reasons.push("two_person_approval_required");
    requirements.push("two_person_approval");
  }

  return {
    allowed: reasons.length === 0,
    requiresStepUp: true,
    requiresTwoPersonApproval: true,
    ownerEmergency: false,
    reasons,
    reason: reasons.join(", "),
    requirements,
    auditRequired: true,
  };
}

export interface AuditEventInput {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  zoneId?: string | null;
  previousState?: unknown;
  newState?: unknown;
  reason: string;
  requestIp?: string | null;
  deviceMetadata?: Record<string, unknown>;
  correlationId: string;
  automated?: boolean;
  createdAt?: string;
}

export interface AuditEventCompatInput {
  actor: { id: string; roleKey: string };
  action: string;
  resource: ResourceContext & { type: string; id: string };
  previousState?: unknown;
  newState?: unknown;
  reason: string;
  request: { ip?: string | null; deviceId?: string | null };
  correlationId: string;
  automated: boolean;
  timestamp?: Date;
}

export interface AuditEventRow {
  actor_id: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  zone_id: string | null;
  previous_state: unknown;
  new_state: unknown;
  reason: string;
  request_ip: string | null;
  device_metadata: Record<string, unknown>;
  correlation_id: string;
  automated: boolean;
  created_at: string;
}

export interface AuditEventCompatRow {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  zoneId: string | null;
  previousState: unknown;
  newState: unknown;
  reason: string;
  requestIp: string | null;
  deviceId: string | null;
  timestamp: string;
  correlationId: string;
  automated: boolean;
  appendOnly: true;
  applicationMutable: false;
}

export function buildAuditEvent(input: AuditEventInput): AuditEventRow;
export function buildAuditEvent(input: AuditEventCompatInput): AuditEventCompatRow;
export function buildAuditEvent(
  input: AuditEventInput | AuditEventCompatInput,
): AuditEventRow | AuditEventCompatRow {
  if ("actor" in input) {
    if (input.reason.trim().length === 0) {
      throw new Error("Audit reason is required.");
    }
    if (input.correlationId.trim().length === 0) {
      throw new Error("Audit correlation id is required.");
    }

    return {
      actorId: input.actor.id,
      actorRole: input.actor.roleKey,
      action: input.action,
      resourceType: input.resource.type,
      resourceId: input.resource.id,
      zoneId: input.resource.zoneId ?? null,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      reason: input.reason,
      requestIp: input.request.ip ?? null,
      deviceId: input.request.deviceId ?? null,
      timestamp: (input.timestamp ?? new Date()).toISOString(),
      correlationId: input.correlationId,
      automated: input.automated,
      appendOnly: true,
      applicationMutable: false,
    };
  }

  if (input.reason.trim().length === 0) {
    throw new Error("Audit reason is required.");
  }
  if (input.correlationId.trim().length === 0) {
    throw new Error("Audit correlation id is required.");
  }

  return {
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    zone_id: input.zoneId ?? null,
    previous_state: input.previousState ?? null,
    new_state: input.newState ?? null,
    reason: input.reason,
    request_ip: input.requestIp ?? null,
    device_metadata: input.deviceMetadata ?? {},
    correlation_id: input.correlationId,
    automated: input.automated ?? false,
    created_at: input.createdAt ?? new Date().toISOString(),
  };
}

export interface PermissionEngine {
  can: (actor: ActorContext, scope: string, resource: ResourceContext) => GuardResult;
}

export function createPermissionEngine(options: { now?: () => Date } = {}): PermissionEngine {
  return {
    can(actor, scope, resource) {
      if (!isPermissionScope(scope)) {
        return deny("Unknown permission scope.", 403);
      }

      const now = options.now?.() ?? new Date();
      const decision = checkPermission({ actor, scope, resource, now });
      if (!decision.allowed) {
        return deny(decision.reasons.join(", "), 403);
      }

      if (resource.riskLevel === "high" && isMutatingScope(scope)) {
        const highRisk = evaluateHighRiskAction({ actor, action: scope, resource, now });
        if (!highRisk.allowed) {
          return {
            allowed: false,
            status: 403,
            statusCode: 403,
            reason: highRisk.reason || "High-risk action requires approval.",
            requirements: highRisk.requirements,
          };
        }
      }

      return { allowed: true };
    },
  };
}

export const APPEND_ONLY_AUDIT_TABLES = [
  "audit_events",
  "permission_audit",
  "moderation_actions",
] as const;

export function assertAuditAppendOnlyOperation(operation: "insert" | "update" | "delete"): void {
  if (operation !== "insert") {
    throw new Error("Audit tables are append-only; update/delete is prohibited.");
  }
}

export function isPermissionScope(scope: string): scope is PermissionScope {
  return (PERMISSION_SCOPES as readonly string[]).includes(scope);
}

export function isHighRiskAction(action: string): action is HighRiskAction {
  return (HIGH_RISK_ACTIONS as readonly string[]).includes(action);
}

export function actorHasRole(actor: ActorContext, roleKey: string, now = new Date()): boolean {
  return activeRoleBindings(actor, now).some((binding) => binding.roleKey === roleKey);
}

export function activeRoleBindings(actor: ActorContext, now = new Date()): RoleBinding[] {
  return actor.roleBindings.filter((binding) => {
    if (binding.revokedAt !== undefined && binding.revokedAt !== null) {
      return false;
    }
    if (binding.expiresAt === undefined || binding.expiresAt === null) {
      return true;
    }
    return new Date(binding.expiresAt).getTime() > now.getTime();
  });
}

export function hasRecentStepUp(
  actor: ActorContext,
  now = new Date(),
  windowMs = 15 * 60 * 1_000,
): boolean {
  return [
    actor.stepUpVerifiedAt,
    actor.stepUpAuthenticatedAt,
    actor.mfaVerifiedAt,
    actor.passkeyVerifiedAt,
  ].some((value) => {
    if (value === undefined || value === null) {
      return false;
    }
    const ageMs = now.getTime() - new Date(value).getTime();
    return ageMs >= 0 && ageMs <= windowMs;
  });
}

function roleBindingPermissions(binding: RoleBinding): readonly string[] {
  if (binding.permissions !== undefined && binding.permissions.length > 0) {
    return binding.permissions;
  }

  if (isSystemRoleKey(binding.roleKey)) {
    return SYSTEM_ROLES[binding.roleKey].permissions;
  }

  return [];
}

function bindingAppliesToResource(binding: RoleBinding, resource?: ResourceContext): boolean {
  if (binding.zoneId === undefined || binding.zoneId === null) {
    return true;
  }
  return resource?.zoneId === binding.zoneId;
}

function isMutatingScope(scope: PermissionScope): boolean {
  return !scope.endsWith(".read") && scope !== "audit.read" && scope !== "system.settings_read";
}

function isSystemRoleKey(roleKey: string): roleKey is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(roleKey);
}

function deny(reason: string, status: number): GuardResult {
  return {
    allowed: false,
    status,
    statusCode: status,
    reason: reason ? reason.replaceAll("_", " ") : "Permission denied.",
  };
}
