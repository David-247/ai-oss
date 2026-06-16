import { describe, expect, it } from "vitest";

const PERMISSIONS_PACKAGE = "@ai-oss/permissions";

const EXPECTED_GLOBAL_ROLE_KEYS = [
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

const EXPECTED_PERMISSION_SCOPES = [
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

type RoleBindingFixture = {
  roleKey: string;
  permissions?: readonly string[];
  zoneId?: string | null;
  expiresAt?: string | null;
};

type ActorFixture = {
  id: string;
  roleBindings: readonly RoleBindingFixture[];
  stepUpAuthenticatedAt?: string;
  approvalActorIds?: readonly string[];
};

type ResourceFixture = {
  type: string;
  id: string;
  ownerId?: string;
  zoneId?: string | null;
  legalHold?: boolean;
  riskLevel?: "low" | "medium" | "high";
  requiresOwnership?: boolean;
};

type PermissionDecision = {
  allowed: boolean;
  reason?: string;
  requirements?: readonly string[];
};

type PermissionEngine = {
  can: (actor: ActorFixture, scope: string, resource: ResourceFixture) => PermissionDecision;
};

type PermissionExports = {
  GLOBAL_ROLE_KEYS: readonly string[];
  PERMISSION_SCOPE_CATALOG: readonly string[];
  createPermissionEngine: (options?: { now?: () => Date }) => PermissionEngine;
  evaluateHighRiskAction: (input: {
    actor: ActorFixture;
    action: string;
    resource: ResourceFixture;
    ownerEmergency?: boolean;
    now?: Date;
  }) => PermissionDecision & {
    auditRequired?: boolean;
    ownerEmergency?: boolean;
  };
};

type PermissionModule = Partial<PermissionExports> & Record<string, unknown>;

async function loadPermissions(): Promise<PermissionModule> {
  try {
    return (await import(PERMISSIONS_PACKAGE)) as PermissionModule;
  } catch (error) {
    throw new Error(
      "@ai-oss/tests must be able to resolve @ai-oss/permissions for Phase 04 authorization tests.",
      { cause: error },
    );
  }
}

function requireExport<K extends keyof PermissionExports>(
  module: PermissionModule,
  name: K,
): PermissionExports[K] {
  const value = module[name];
  expect(value, `@ai-oss/permissions must export ${name} for Phase 04.`).toBeDefined();
  return value as PermissionExports[K];
}

describe("Phase 04 permission engine contract", () => {
  it("exports every required global role key and the complete Phase 04 scope catalog", async () => {
    const module = await loadPermissions();
    const globalRoleKeys = requireExport(module, "GLOBAL_ROLE_KEYS");
    const permissionScopeCatalog = requireExport(module, "PERMISSION_SCOPE_CATALOG");

    expect(globalRoleKeys).toEqual(EXPECTED_GLOBAL_ROLE_KEYS);
    expect(new Set(globalRoleKeys).size).toBe(globalRoleKeys.length);

    expect(permissionScopeCatalog).toEqual(EXPECTED_PERMISSION_SCOPES);
    expect(new Set(permissionScopeCatalog).size).toBe(permissionScopeCatalog.length);
  });

  it("honors wildcard scopes, custom granular roles, system owner access, and expired role bindings", async () => {
    const module = await loadPermissions();
    const createPermissionEngine = requireExport(module, "createPermissionEngine");
    const engine = createPermissionEngine({
      now: () => new Date("2026-06-12T12:00:00.000Z"),
    });

    const customUserAdmin: ActorFixture = {
      id: "admin-1",
      roleBindings: [
        {
          roleKey: "custom:user-admin",
          permissions: ["users.*"],
        },
      ],
    };

    expect(
      engine.can(customUserAdmin, "users.ban", {
        type: "profile",
        id: "user-2",
      }),
    ).toMatchObject({ allowed: true });
    expect(
      engine.can(customUserAdmin, "roles.*", {
        type: "role",
        id: "super_admin",
      }),
    ).toMatchObject({ allowed: false });

    const customSupport: ActorFixture = {
      id: "support-1",
      roleBindings: [
        {
          roleKey: "custom:support-basic",
          permissions: ["users.read", "users.update_basic"],
        },
      ],
    };

    expect(
      engine.can(customSupport, "users.update_basic", {
        type: "profile",
        id: "user-2",
      }),
    ).toMatchObject({ allowed: true });
    expect(
      engine.can(customSupport, "users.ban", {
        type: "profile",
        id: "user-2",
      }),
    ).toMatchObject({ allowed: false });

    const owner: ActorFixture = {
      id: "owner-1",
      roleBindings: [{ roleKey: "owner" }],
    };
    expect(
      engine.can(owner, "security.*", {
        type: "security_setting",
        id: "waf",
      }),
    ).toMatchObject({ allowed: true });

    const expiredAdmin: ActorFixture = {
      id: "former-admin-1",
      roleBindings: [
        {
          roleKey: "custom:stale-user-admin",
          permissions: ["users.*"],
          expiresAt: "2026-06-12T11:59:59.000Z",
        },
      ],
    };
    expect(
      engine.can(expiredAdmin, "users.suspend", {
        type: "profile",
        id: "user-2",
      }),
    ).toMatchObject({ allowed: false });
  });

  it("applies ABAC ownership, zone, legal-hold, and risk predicates after RBAC grants", async () => {
    const module = await loadPermissions();
    const createPermissionEngine = requireExport(module, "createPermissionEngine");
    const engine = createPermissionEngine({
      now: () => new Date("2026-06-12T12:00:00.000Z"),
    });

    const zoneEditor: ActorFixture = {
      id: "user-1",
      roleBindings: [
        {
          roleKey: "custom:zone-content-editor",
          permissions: ["content.*"],
          zoneId: "zone-a",
        },
      ],
    };

    expect(
      engine.can(zoneEditor, "content.*", {
        type: "post",
        id: "post-1",
        ownerId: "user-1",
        zoneId: "zone-a",
        requiresOwnership: true,
        legalHold: false,
        riskLevel: "low",
      }),
    ).toMatchObject({ allowed: true });

    expect(
      engine.can(zoneEditor, "content.*", {
        type: "post",
        id: "post-2",
        ownerId: "user-2",
        zoneId: "zone-a",
        requiresOwnership: true,
        legalHold: false,
        riskLevel: "low",
      }),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/owner|ownership/i),
    });

    expect(
      engine.can(zoneEditor, "content.*", {
        type: "post",
        id: "post-3",
        ownerId: "user-1",
        zoneId: "zone-b",
        requiresOwnership: true,
        legalHold: false,
        riskLevel: "low",
      }),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/zone/i),
    });

    expect(
      engine.can(zoneEditor, "content.*", {
        type: "post",
        id: "post-4",
        ownerId: "user-1",
        zoneId: "zone-a",
        requiresOwnership: true,
        legalHold: true,
        riskLevel: "low",
      }),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/legal hold/i),
    });

    expect(
      engine.can(zoneEditor, "content.*", {
        type: "post",
        id: "post-5",
        ownerId: "user-1",
        zoneId: "zone-a",
        requiresOwnership: true,
        legalHold: false,
        riskLevel: "high",
      }),
    ).toMatchObject({
      allowed: false,
      requirements: expect.arrayContaining(["step_up_authentication", "two_person_approval"]),
    });
  });

  it("requires step-up authentication and two-person approval for high-risk actions unless owner emergency is audited", async () => {
    const module = await loadPermissions();
    const evaluateHighRiskAction = requireExport(module, "evaluateHighRiskAction");
    const resource: ResourceFixture = {
      type: "role_binding",
      id: "binding-1",
      riskLevel: "high",
    };

    const superAdmin: ActorFixture = {
      id: "admin-1",
      roleBindings: [{ roleKey: "super_admin" }],
    };

    expect(
      evaluateHighRiskAction({
        actor: superAdmin,
        action: "roles.grant_owner",
        resource,
        now: new Date("2026-06-12T12:00:00.000Z"),
      }),
    ).toMatchObject({
      allowed: false,
      requirements: expect.arrayContaining(["step_up_authentication", "two_person_approval"]),
    });

    expect(
      evaluateHighRiskAction({
        actor: {
          ...superAdmin,
          stepUpAuthenticatedAt: "2026-06-12T11:58:00.000Z",
          approvalActorIds: ["admin-2"],
        },
        action: "roles.grant_owner",
        resource,
        now: new Date("2026-06-12T12:00:00.000Z"),
      }),
    ).toMatchObject({ allowed: true });

    expect(
      evaluateHighRiskAction({
        actor: {
          id: "owner-1",
          roleBindings: [{ roleKey: "owner" }],
        },
        action: "security.waf_bypass_change",
        resource: { type: "security_setting", id: "waf", riskLevel: "high" },
        ownerEmergency: true,
        now: new Date("2026-06-12T12:00:00.000Z"),
      }),
    ).toMatchObject({
      allowed: true,
      auditRequired: true,
      ownerEmergency: true,
    });
  });
});
