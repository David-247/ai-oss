import { NextResponse } from "next/server";
import {
  buildConsentEvents,
  createSupabaseAnonClient,
  sanitizeProfileUpdate,
  validateSignupInput,
} from "@ai-oss/auth";
import {
  authConfigStatus,
  clearSessionCookies,
  getServiceClientOrProblem,
  problem,
  readSessionTokens,
  requireAuthenticatedUser,
  setSessionCookies,
} from "@/lib/auth-server";

export const runtime = "nodejs";

export function GET() {
  const status = authConfigStatus();
  return NextResponse.json(
    {
      provider: "supabase",
      configured: status.publicConfig.configured,
      servicePersistenceConfigured: status.serviceConfig.configured,
      actions: [
        "signup",
        "login",
        "passwordless",
        "oauth",
        "reset_password",
        "logout",
        "logout_everywhere",
        "revoke_session",
        "change_email",
        "enroll_mfa",
        "enroll_passkey",
      ],
      requiredConsents: [
        "terms",
        "privacy",
        "community_guidelines",
        "research_publishing",
        "cookie_policy",
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = normalizeAuthBody(await readRequestBody(request));
  if (!isRecord(body)) {
    return problem(400, "invalid-auth-request", "Expected a JSON object body.");
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action === "logout") {
    return clearSessionCookies(
      NextResponse.json(
        { ok: true, action, revokeLocalSession: true },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  const { publicConfig } = authConfigStatus();
  if (!publicConfig.configured) {
    return problem(
      503,
      "auth-not-configured",
      "Supabase Auth environment variables are not configured.",
    );
  }

  const authClient = createSupabaseAnonClient(publicConfig);

  if (action === "logout_everywhere" || action === "revoke_session") {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const service = getServiceClientOrProblem();
    if (service.ok) {
      const scope = action === "logout_everywhere" ? "global" : "local";
      const { error } = await service.client.auth.admin.signOut(auth.token, scope);
      if (error !== null) {
        return problem(400, "session-revoke-failed", error.message);
      }
    }

    return clearSessionCookies(
      NextResponse.json(
        {
          ok: true,
          action,
          revoked: action === "logout_everywhere" ? "all_sessions" : "current_session",
        },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  if (action === "change_email") {
    const email = readString(body.newEmail) || readString(body.new_email);
    if (!email.includes("@")) {
      return problem(400, "email-change-validation", "A valid new email is required.");
    }

    const session = readSessionTokens(request);
    if (session.accessToken === null || session.refreshToken === null) {
      return problem(
        401,
        "missing-session",
        "Email change requires a cookie-backed or bearer session.",
      );
    }

    await authClient.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    const { data, error } = await authClient.auth.updateUser({ email });
    if (error !== null) {
      return problem(400, "email-change-failed", error.message);
    }

    return NextResponse.json(
      { ok: true, action, user: data.user, confirmationRequired: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "enroll_mfa") {
    const session = readSessionTokens(request);
    if (session.accessToken === null || session.refreshToken === null) {
      return problem(
        401,
        "missing-session",
        "MFA enrollment requires a cookie-backed or bearer session.",
      );
    }

    await authClient.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    const { data, error } = await authClient.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error !== null) {
      return problem(400, "mfa-enroll-failed", error.message);
    }

    return NextResponse.json(
      { ok: true, action, factor: data },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "enroll_passkey") {
    return NextResponse.json(
      {
        ok: true,
        action,
        enrollment: "passkey_requires_browser_webauthn_flow",
      },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "signup") {
    const parsed = validateSignupInput(body);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          type: "https://www.ai-oss.net/errors/signup-validation",
          title: "Signup validation failed",
          status: 400,
          issues: parsed.issues,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data, error } = parsed.data.passwordless
      ? await authClient.auth.signInWithOtp({
          email: parsed.data.email,
          options: {
            data: {
              username: parsed.data.username,
              display_name: parsed.data.displayName,
            },
          },
        })
      : await authClient.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password ?? "",
          options: {
            data: {
              username: parsed.data.username,
              display_name: parsed.data.displayName,
            },
          },
        });

    if (error !== null) {
      return problem(400, "signup-failed", error.message);
    }

    const userId = "user" in data ? data.user?.id : undefined;
    if (userId !== undefined) {
      const service = getServiceClientOrProblem();
      if (service.ok) {
        const profile = sanitizeProfileUpdate({
          username: parsed.data.username,
          displayName: parsed.data.displayName,
          bio: parsed.data.bio,
        });
        await service.client.from("profiles").upsert({
          id: userId,
          username: profile.username ?? parsed.data.username,
          display_name: profile.displayName,
          bio: profile.bio,
        });
        await service.client.from("user_settings").upsert({ user_id: userId });
        await service.client.from("user_security_state").upsert({ user_id: userId });
        await service.client.from("consent_events").insert(buildConsentEvents(userId, parsed.data));
      }
    }

    const response = NextResponse.json(
      {
        ok: true,
        action,
        userId,
        emailVerificationRequired: true,
        passwordless: parsed.data.passwordless === true,
      },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
    if ("session" in data && data.session !== null) {
      setSessionCookies(response, data.session);
    }
    return response;
  }

  if (action === "login") {
    const email = readString(body.email);
    const password = readString(body.password);
    if (!email || !password) {
      return problem(400, "login-validation", "Email and password are required.");
    }

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error !== null) {
      return problem(401, "login-failed", error.message);
    }

    const response = NextResponse.json(
      {
        ok: true,
        action,
        user: data.user,
        session: data.session,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (data.session !== null) {
      setSessionCookies(response, data.session);
    }
    return response;
  }

  if (action === "passwordless") {
    const email = readString(body.email);
    if (!email) {
      return problem(400, "passwordless-validation", "Email is required.");
    }

    const { error } = await authClient.auth.signInWithOtp({ email });
    if (error !== null) {
      return problem(400, "passwordless-failed", error.message);
    }

    return NextResponse.json(
      { ok: true, action, emailSent: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "oauth") {
    const provider = readString(body.provider);
    if (provider !== "github") {
      return problem(400, "oauth-provider", "Only GitHub OAuth is supported.");
    }

    const redirectTo = readString(body.redirectTo);
    const { data, error } = await authClient.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error !== null) {
      return problem(400, "oauth-failed", error.message);
    }

    return NextResponse.json(
      { ok: true, action, url: data.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "reset_password") {
    const email = readString(body.email);
    if (!email) {
      return problem(400, "reset-validation", "Email is required.");
    }

    const { error } = await authClient.auth.resetPasswordForEmail(email);
    if (error !== null) {
      return problem(400, "reset-failed", error.message);
    }

    return NextResponse.json(
      { ok: true, action, emailSent: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  return problem(400, "unknown-auth-action", "Unknown auth action.");
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

function normalizeAuthBody(body: unknown): unknown {
  if (!isRecord(body)) {
    return body;
  }

  const actionAliases: Record<string, string> = {
    password_reset: "reset_password",
    passwordless_login: "passwordless",
    github_oauth: "oauth",
  };
  const action = readString(body.action);
  const normalizedAction = actionAliases[action] ?? action;

  return {
    ...body,
    action: normalizedAction,
    provider: normalizedAction === "oauth" ? readString(body.provider) || "github" : body.provider,
    displayName: body.displayName ?? body.display_name,
    ageAttested:
      body.ageAttested === true || body.ageAttested === "true" || body.age_attestation === "true",
    consents: isRecord(body.consents)
      ? body.consents
      : {
          terms: readConsentVersion(body.terms_consent, body.terms_version),
          privacy: readConsentVersion(body.privacy_policy_consent, body.privacy_policy_version),
          community_guidelines: readConsentVersion(
            body.community_guidelines_consent,
            body.community_guidelines_version,
          ),
          research_publishing: readConsentVersion(
            body.research_publishing_policy_consent,
            body.research_publishing_policy_version,
          ),
          cookie_policy: readConsentVersion(body.cookie_policy_consent, body.cookie_policy_version),
        },
  };
}

function readConsentVersion(consent: unknown, version: unknown): string | undefined {
  return consent === true || consent === "true" ? readString(version) || "phase-03" : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
