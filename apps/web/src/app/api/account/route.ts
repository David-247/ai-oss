import { NextResponse } from "next/server";
import { sanitizePrivacySettings, sanitizeProfileUpdate } from "@ai-oss/auth";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const [profile, settings, security] = await Promise.all([
    service.client.from("profiles").select("*").eq("id", auth.user.id).single(),
    service.client.from("user_settings").select("*").eq("user_id", auth.user.id).single(),
    service.client
      .from("user_security_state")
      .select("mfa_enrolled, passkey_enrolled, elevated_mfa_required, last_login_at, risk_level")
      .eq("user_id", auth.user.id)
      .single(),
  ]);

  return NextResponse.json(
    {
      user: auth.user,
      profile: profile.data,
      settings: settings.data,
      security: security.data,
      errors: [profile.error, settings.error, security.error]
        .filter((error) => error !== null)
        .map((error) => error.message),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  return updateAccount(request);
}

export async function PATCH(request: Request) {
  return updateAccount(request);
}

async function updateAccount(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const body = normalizeAccountBody(await readRequestBody(request));
  if (!isRecord(body)) {
    return problem(400, "invalid-account-update", "Expected a JSON object body.");
  }

  const profile = sanitizeProfileUpdate(body.profile);
  const privacy = sanitizePrivacySettings(body.privacy);

  if (Object.keys(profile).length > 0) {
    await service.client.from("profiles").update(toProfileRow(profile)).eq("id", auth.user.id);
  }

  if (Object.keys(privacy).length > 0) {
    await service.client.from("user_settings").upsert({
      user_id: auth.user.id,
      privacy: privacy,
      notifications: privacy.notificationPreferences ?? {},
      cookie_consent: privacy.cookieConsent ?? {},
      analytics_consent: privacy.analyticsConsent,
      email_digest_frequency: privacy.emailDigestFrequency,
      public_donor_badge_opt_in: privacy.publicDonorBadgeOptIn,
      dm_permissions: privacy.dmPermissions,
    });
  }

  return NextResponse.json(
    { ok: true, updated: { profile, privacy } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

function normalizeAccountBody(body: unknown): unknown {
  if (!isRecord(body)) {
    return body;
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (body.profile !== undefined || body.privacy !== undefined) {
    return body;
  }

  if (action === "update_profile") {
    return {
      profile: {
        username: body.username,
        displayName: body.display_name,
        bio: body.bio,
        websiteUrl: body.website_url,
        githubUsername: body.github_username,
        orcid: body.orcid,
        affiliation: body.affiliation,
        researchInterests: splitTags(body.research_interests),
      },
    };
  }

  if (action === "update_privacy") {
    return {
      profile: {
        profileVisibility: normalizeVisibility(body.profile_visibility),
        emailVisibility: normalizeVisibility(body.email_visibility),
        contactPermission: normalizeContactPermission(body.contact_permissions),
        searchIndexingEnabled: body.allow_profile_search_indexing === "true",
        donorBadgeVisible: body.show_public_donor_badge === "true",
      },
      privacy: {
        analyticsConsent: body.allow_cookie_analytics === "true",
        cookieConsent: {
          analytics: body.allow_cookie_analytics === "true",
        },
        visibility: {
          affiliation: normalizeVisibility(body.affiliation_visibility),
        },
        publicDonorBadgeOptIn: body.show_public_donor_badge === "true",
        dmPermissions: normalizeContactPermission(body.contact_permissions),
      },
    };
  }

  if (action === "update_notifications") {
    return {
      privacy: {
        notificationPreferences: {
          security_alerts: true,
          product_updates: body.product_updates === "true",
          research_activity: body.research_activity === "true",
          moderation_activity: body.moderation_activity === "true",
          zone_digest: body.zone_digest === "true",
          donation_updates: body.donation_updates === "true",
          digest_format: body.digest_format,
        },
        emailDigestFrequency: body.digest_frequency === "none" ? "never" : body.digest_frequency,
      },
    };
  }

  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProfileRow(profile: ReturnType<typeof sanitizeProfileUpdate>) {
  return {
    username: profile.username,
    display_name: profile.displayName,
    bio: profile.bio,
    website_url: profile.websiteUrl,
    github_username: profile.githubUsername,
    orcid: profile.orcid,
    affiliation: profile.affiliation,
    research_interests: profile.researchInterests,
    profile_visibility: profile.profileVisibility,
    email_visibility: profile.emailVisibility,
    contact_permission: profile.contactPermission,
    search_indexing_enabled: profile.searchIndexingEnabled,
    donor_badge_visible: profile.donorBadgeVisible,
  };
}

function splitTags(value: unknown): string[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
}

function normalizeVisibility(value: unknown) {
  if (value === "members") {
    return "authenticated";
  }
  return value;
}

function normalizeContactPermission(value: unknown) {
  if (value === "trusted") {
    return "members";
  }
  if (value === "members" || value === "none" || value === "everyone") {
    return value;
  }
  return undefined;
}
