import { describe, expect, it } from "vitest";

const PERMISSIONS_PACKAGE = "@ai-oss/permissions";

type RoleBindingFixture = {
  roleKey: string;
  permissions?: readonly string[];
  zoneId?: string | null;
};

type ActorFixture = {
  id: string;
  roleBindings: readonly RoleBindingFixture[];
};

type ResourceFixture = {
  type: string;
  id: string;
  zoneId?: string | null;
  riskLevel?: "low" | "medium" | "high";
};

type AuditEvent = {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  zoneId?: string | null;
  previousState?: unknown;
  newState?: unknown;
  reason: string;
  requestIp?: string;
  deviceId?: string;
  timestamp: string;
  correlationId: string;
  automated: boolean;
  appendOnly: true;
  applicationMutable: false;
};

type GuardResult = {
  allowed: boolean;
  status?: number;
  statusCode?: number;
  reason?: string;
};

type PermissionExports = {
  buildAuditEvent: (input: {
    actor: { id: string; roleKey: string };
    action: string;
    resource: ResourceFixture;
    previousState?: unknown;
    newState?: unknown;
    reason: string;
    request: { ip: string; deviceId?: string };
    correlationId: string;
    automated: boolean;
    timestamp?: Date;
  }) => AuditEvent;
  requirePermission: (
    scope: string,
    resource: ResourceFixture,
  ) => (input: { actor: ActorFixture }) => GuardResult | Promise<GuardResult>;
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
  expect(
    value,
    `@ai-oss/permissions must export ${name} for Phase 04 security tests.`,
  ).toBeDefined();
  return value as PermissionExports[K];
}

async function expectGuardDenied(
  runGuard: () => GuardResult | Promise<GuardResult>,
): Promise<void> {
  try {
    const result = await runGuard();
    expect(result).toMatchObject({ allowed: false });
    expect(result.status ?? result.statusCode).toBe(403);
    expect(result.reason).toMatch(/permission|denied|forbidden/i);
  } catch (error) {
    expect(error).toMatchObject({
      status: 403,
    });
    expect(error).toMatchObject({
      message: expect.stringMatching(/permission|denied|forbidden/i),
    });
  }
}

describe("Phase 04 authorization guard and audit logging", () => {
  it("builds complete append-only audit events for manual and automated admin actions", async () => {
    const module = await loadPermissions();
    const buildAuditEvent = requireExport(module, "buildAuditEvent");

    expect(
      buildAuditEvent({
        actor: { id: "admin-1", roleKey: "security_admin" },
        action: "security.waf_bypass_change",
        resource: {
          type: "security_setting",
          id: "waf",
          zoneId: null,
          riskLevel: "high",
        },
        previousState: { summary: "WAF bypass disabled" },
        newState: { summary: "Temporary bypass for incident response" },
        reason: "Incident response window IR-123",
        request: { ip: "203.0.113.10", deviceId: "device-abc" },
        correlationId: "corr-20260612-0001",
        automated: false,
        timestamp: new Date("2026-06-12T12:00:00.000Z"),
      }),
    ).toMatchObject({
      actorId: "admin-1",
      actorRole: "security_admin",
      action: "security.waf_bypass_change",
      resourceType: "security_setting",
      resourceId: "waf",
      zoneId: null,
      previousState: { summary: "WAF bypass disabled" },
      newState: { summary: "Temporary bypass for incident response" },
      reason: "Incident response window IR-123",
      requestIp: "203.0.113.10",
      deviceId: "device-abc",
      timestamp: "2026-06-12T12:00:00.000Z",
      correlationId: "corr-20260612-0001",
      automated: false,
      appendOnly: true,
      applicationMutable: false,
    });

    expect(
      buildAuditEvent({
        actor: { id: "automod", roleKey: "system" },
        action: "moderation.bulk_content_removal",
        resource: { type: "automod_run", id: "run-1", riskLevel: "high" },
        previousState: { summary: "No removals queued" },
        newState: { summary: "Queued bulk removal review" },
        reason: "Automated high-confidence malware campaign detection",
        request: { ip: "127.0.0.1" },
        correlationId: "corr-20260612-automod-1",
        automated: true,
        timestamp: new Date("2026-06-12T12:05:00.000Z"),
      }),
    ).toMatchObject({
      actorId: "automod",
      actorRole: "system",
      automated: true,
      appendOnly: true,
      applicationMutable: false,
      correlationId: "corr-20260612-automod-1",
      reason: expect.stringMatching(/Automated high-confidence/),
    });
  });

  it("denies unauthorized route access when the actor lacks the required permission", async () => {
    const module = await loadPermissions();
    const requirePermission = requireExport(module, "requirePermission");
    const guard = requirePermission("roles.*", {
      type: "role",
      id: "super_admin",
      riskLevel: "high",
    });

    await expectGuardDenied(() =>
      guard({
        actor: {
          id: "support-1",
          roleBindings: [
            {
              roleKey: "custom:support-basic",
              permissions: ["users.read", "users.update_basic"],
            },
          ],
        },
      }),
    );
  });
});
