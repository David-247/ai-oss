import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve("..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 16 admin panel security", () => {
  it("gates admin pages server-side with panel permissions", () => {
    const page = readRepoFile("apps/web/src/app/admin/[[...section]]/page.tsx");
    expect(page).toContain("force-dynamic");
    expect(page).toContain("headers()");
    expect(page).toContain("requirePermissionForRequest");
    expect(page).toContain("panel.permission");
    expect(page).toContain("AdminDenied");
  });

  it("replaces admin API stubs with server-side permission-gated handlers", () => {
    const rootRoute = readRepoFile("apps/web/src/app/api/admin/route.ts");
    const catchallRoute = readRepoFile("apps/web/src/app/api/admin/[...panel]/route.ts");
    const server = readRepoFile("apps/web/src/lib/admin-server.ts");
    expect(rootRoute).not.toContain("notImplemented");
    expect(catchallRoute).toContain("handleAdminGet");
    expect(server).toContain("requirePermissionForRequest");
    expect(server).toContain("requireHighRiskApproval");
    expect(server).toContain("insertAuditEvent");
    expect(server).toContain("buildStatementOfReasons");
    expect(server).toContain("Cache-Control");
    expect(server).toContain("no-store");
    expect(server).toContain("serverSideOnly");
  });

  it("covers all required admin section checklists in the admin package", () => {
    const source = readRepoFile("packages/admin/src/index.ts");
    for (const required of [
      "System health",
      "Search users",
      "Custom role builder",
      "Zone search",
      "Unified content queue",
      "Paper search",
      "YAML/JSON import and export",
      "Appeal inbox",
      "DMCA and counter-notices",
      "User privacy requests",
      "Suspicious logins",
      "Donation list and search",
      "Analytics",
      "Audit Log",
      "System",
    ]) {
      expect(source).toContain(required);
    }
  });

  it("keeps impersonation prohibited by default", () => {
    const admin = readRepoFile("packages/admin/src/index.ts");
    const permissions = readRepoFile("packages/permissions/src/index.ts");
    expect(admin).not.toContain("impersonate_user");
    expect(admin).not.toContain("impersonate_for_support");
    expect(permissions).toContain("users.impersonate_for_support_prohibited_by_default");
  });

  it("exposes expected admin route files", () => {
    for (const file of [
      "apps/web/src/app/admin/[[...section]]/page.tsx",
      "apps/web/src/app/api/admin/route.ts",
      "apps/web/src/app/api/admin/[...panel]/route.ts",
      "apps/web/src/app/api/admin/roles/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });
});
