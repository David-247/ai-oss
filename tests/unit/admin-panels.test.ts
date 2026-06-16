import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTIONS,
  ADMIN_HOME_WIDGETS,
  ADMIN_PANELS,
  adminActionForKey,
  adminPanelForSection,
  adminPanelSummaries,
  buildAdminAuditDescriptor,
  buildStatementOfReasons,
} from "@ai-oss/admin";

describe("Phase 16 admin panels", () => {
  it("defines all required admin panels and supporting views", () => {
    expect(ADMIN_PANELS.map((panel) => panel.key)).toEqual(
      expect.arrayContaining([
        "overview",
        "users",
        "roles",
        "zones",
        "content",
        "reports",
        "moderation",
        "research",
        "automod",
        "appeals",
        "legal",
        "privacy-requests",
        "security",
        "donations",
        "analytics",
        "audit-log",
        "system",
      ]),
    );
    expect(ADMIN_HOME_WIDGETS).toEqual(
      expect.arrayContaining([
        "System health",
        "Pending reports",
        "Pending appeals",
        "Quarantined papers",
        "Abuse spikes",
        "New-user growth",
        "Active zones",
        "Donation summary",
        "Security alerts",
        "Privacy/legal deadlines",
        "Recent admin actions",
        "Background job failures",
      ]),
    );
  });

  it("maps legacy shell aliases to the concrete panel definitions", () => {
    expect(adminPanelForSection(["privacy"]).key).toBe("privacy-requests");
    expect(adminPanelForSection(["finance"]).key).toBe("donations");
    expect(adminPanelForSection(["audit"]).key).toBe("audit-log");
    expect(adminPanelForSection(["settings"]).key).toBe("system");
    expect(adminPanelSummaries().every((panel) => panel.checklistCount > 0)).toBe(true);
  });

  it("requires permissions and data sources for every panel", () => {
    for (const panel of ADMIN_PANELS) {
      expect(panel.permission.length, `${panel.key} permission`).toBeGreaterThan(0);
      expect(panel.checklist.length, `${panel.key} checklist`).toBeGreaterThan(0);
      expect(panel.tables.length, `${panel.key} tables`).toBeGreaterThan(0);
    }
  });

  it("defines audited high-risk admin actions", () => {
    expect(ADMIN_ACTIONS.every((action) => action.audited)).toBe(true);
    expect(adminActionForKey("grant_role")).toMatchObject({
      permission: "roles.grant",
      highRisk: true,
      resourceType: "role_binding",
    });
    expect(adminActionForKey("content_restore")).toMatchObject({
      permission: "moderation.update",
      highRisk: false,
    });
    expect(adminActionForKey("impersonate_user")).toBeNull();
  });

  it("builds admin audit descriptors and statement-of-reasons templates", () => {
    expect(
      buildAdminAuditDescriptor({
        panel: "content",
        action: "content_remove",
        actorId: "admin-1",
        resourceType: "post",
        resourceId: "post-1",
        reason: "Policy violation confirmed.",
      }),
    ).toMatchObject({
      action: "admin.content.content_remove",
      metadata: { serverSideOnly: true, audited: true },
    });
    expect(() =>
      buildAdminAuditDescriptor({
        panel: "users",
        action: "mark_user_review",
        actorId: "admin-1",
        resourceType: "profile",
        reason: "short",
      }),
    ).toThrow(/reason/i);

    expect(
      buildStatementOfReasons({
        action: "content_remove",
        policy: "Community Guidelines",
        facts: ["spam", "repeat"],
        appealable: true,
        jurisdiction: "dsa",
      }),
    ).toMatchObject({
      jurisdiction: "dsa",
      generatedForAdminPanel: true,
      appealable: true,
    });
  });
});
