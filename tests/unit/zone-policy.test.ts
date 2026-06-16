import { describe, expect, it } from "vitest";
import {
  assertZoneRoleWithinGlobalPolicy,
  buildDefaultZoneSettings,
  buildFounderMembership,
  buildGovernanceEvent,
  buildZoneInsertRow,
  buildZoneRoleDefinition,
  evaluateZoneCreation,
  normalizeZoneSlug,
  ZONE_FEATURES,
  ZONE_ROLES,
  zoneFeatureSurface,
} from "@ai-oss/zones";

describe("Phase 07 zone policy", () => {
  it("normalizes slugs and accepts qualified zone creators", () => {
    expect(normalizeZoneSlug("  AI Safety Evals  ")).toBe("ai-safety-evals");

    const decision = evaluateZoneCreation({
      userId: "user-1",
      emailVerified: true,
      accountCreatedAt: "2026-06-01T00:00:00.000Z",
      trustScore: 0,
      slug: "AI Safety Evals",
      name: "AI Safety Evals",
      rules: ["Stay on topic"],
      now: new Date("2026-06-12T00:00:00.000Z"),
      slugAvailable: true,
    });

    expect(decision).toMatchObject({
      allowed: true,
      slug: "ai-safety-evals",
      normalizedName: "AI Safety Evals",
    });

    expect(
      buildZoneInsertRow({
        userId: "user-1",
        emailVerified: true,
        accountCreatedAt: "2026-06-01T00:00:00.000Z",
        trustScore: 0,
        slug: "AI Safety Evals",
        name: "AI Safety Evals",
        rules: ["Stay on topic"],
        now: new Date("2026-06-12T00:00:00.000Z"),
        slugAvailable: true,
        visibility: "restricted",
      }),
    ).toMatchObject({
      slug: "ai-safety-evals",
      visibility: "restricted",
      status: "active",
      created_by: "user-1",
    });
  });

  it("rejects users that fail anti-abuse gates or kill-switch checks", () => {
    expect(
      evaluateZoneCreation({
        userId: "user-1",
        emailVerified: false,
        accountCreatedAt: "2026-06-11T00:00:00.000Z",
        trustScore: 0,
        slug: "x",
        name: "AI",
        rules: [],
        now: new Date("2026-06-12T00:00:00.000Z"),
        slugAvailable: false,
        creationPaused: true,
      }).reasons,
    ).toEqual(
      expect.arrayContaining([
        "zone_creation_paused",
        "email_verification_required",
        "invalid_zone_slug",
        "zone_slug_unavailable",
        "zone_name_length_invalid",
        "account_age_or_trust_threshold_required",
        "zone_rules_required",
      ]),
    );
  });

  it("declares the complete feature surface and zone role model", () => {
    expect(ZONE_FEATURES).toEqual(
      expect.arrayContaining([
        "homepage",
        "posts",
        "comments",
        "voting",
        "rules",
        "wiki",
        "chat_rooms",
        "voice_rooms",
        "member_list",
        "moderator_list",
        "report_flow",
        "modmail",
        "in_zone_search",
        "sort_modes",
        "flairs",
        "pinned_posts",
        "announcements",
        "sidebar",
        "settings",
        "moderation_queue",
        "automod_rules",
        "governance",
      ]),
    );
    expect(ZONE_ROLES).toEqual(
      expect.arrayContaining([
        "zone_owner_founder",
        "lead_moderator",
        "content_moderator",
        "chat_moderator",
        "research_reviewer",
        "automod_editor",
        "wiki_editor",
        "member",
        "restricted_member",
        "banned_user",
      ]),
    );
    expect(zoneFeatureSurface().sortModes).toEqual(
      expect.arrayContaining(["hot", "new", "top", "active", "controversial"]),
    );
  });

  it("builds defaults, founder membership, and global-policy-safe zone roles", () => {
    expect(buildFounderMembership({ zoneId: "zone-1", userId: "user-1" })).toEqual({
      zone_id: "zone-1",
      user_id: "user-1",
      member_role: "admin",
      status: "active",
    });

    expect(
      buildDefaultZoneSettings({
        zoneId: "zone-1",
        actorId: "user-1",
        visibility: "private",
      }).settings,
    ).toMatchObject({
      zone_id: "zone-1",
      automod_config: { enabled: true },
      chat_config: { default_permission: "members" },
    });

    expect(buildZoneRoleDefinition("lead_moderator")).toMatchObject({
      key: "zone:lead_moderator",
      zoneScoped: true,
    });

    expect(() =>
      assertZoneRoleWithinGlobalPolicy("lead_moderator", ["zones.update", "security.update"]),
    ).toThrow(/global policy/i);
  });

  it("builds governance events with certification requirements", () => {
    expect(
      buildGovernanceEvent({
        zoneId: "zone-1",
        action: "community_removal_petition",
        actorId: "user-1",
        targetUserId: "mod-1",
        reason: "Abuse of moderator tools",
      }),
    ).toMatchObject({
      auditAction: "zones.governance.community_removal_petition",
      requiresCertification: true,
      metadata: { public_summary_allowed: true },
    });

    expect(() =>
      buildGovernanceEvent({
        zoneId: "zone-1",
        action: "appeal",
        actorId: "user-1",
        reason: "",
      }),
    ).toThrow(/reason/i);
  });
});
