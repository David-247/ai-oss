import { NextResponse } from "next/server";
import {
  createSupabaseAnonClient,
  createSupabaseServiceClient,
  getSupabasePublicConfig,
  getSupabaseServiceConfig,
} from "@ai-oss/auth";

export function authConfigStatus() {
  const publicConfig = getSupabasePublicConfig(process.env);
  const serviceConfig = getSupabaseServiceConfig(process.env);
  return {
    publicConfig,
    serviceConfig,
    ready: publicConfig.configured && serviceConfig.configured,
  };
}

export async function requireAuthenticatedUser(request: Request) {
  const { publicConfig } = authConfigStatus();
  if (!publicConfig.configured) {
    return {
      ok: false as const,
      response: problem(
        503,
        "auth-not-configured",
        "Supabase Auth environment variables are not configured.",
      ),
    };
  }

  const token = readBearerToken(request);
  if (token === null) {
    return {
      ok: false as const,
      response: problem(
        401,
        "missing-session",
        "Authorization: Bearer <access_token> is required.",
      ),
    };
  }

  const authClient = createSupabaseAnonClient(publicConfig);
  const { data, error } = await authClient.auth.getUser(token);
  if (error !== null || data.user === null) {
    return {
      ok: false as const,
      response: problem(401, "invalid-session", "Session token is invalid."),
    };
  }

  return {
    ok: true as const,
    user: data.user,
    token,
    refreshToken: readCookie(request, "sb-refresh-token"),
  };
}

export function getServiceClientOrProblem() {
  const { serviceConfig } = authConfigStatus();
  if (!serviceConfig.configured) {
    return {
      ok: false as const,
      response: problem(
        503,
        "service-auth-not-configured",
        "Supabase service-role environment variable is not configured server-side.",
      ),
    };
  }

  return {
    ok: true as const,
    client: createSupabaseServiceClient(serviceConfig),
  };
}

export function problem(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json(
    {
      type: `https://www.ai-oss.net/errors/${code}`,
      title: status >= 500 ? "Server configuration error" : "Request rejected",
      status,
      detail,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return readCookie(request, "sb-access-token");
}

export function setSessionCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string; expires_in: number },
): NextResponse {
  const maxAge = Math.max(60, session.expires_in);
  response.cookies.set("sb-access-token", session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge,
  });
  response.cookies.set("sb-refresh-token", session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  for (const name of ["sb-access-token", "sb-refresh-token"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

export function readSessionTokens(request: Request): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  return {
    accessToken: readBearerToken(request),
    refreshToken: readCookie(request, "sb-refresh-token"),
  };
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (cookie === null) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}
