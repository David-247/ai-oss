import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

// §24.4 / acceptance: no service-role or secret keys may be exposed to the
// client. Any var marked NEXT_PUBLIC_* is bundled into client JS, so secret-
// looking names MUST NOT carry that prefix.
const SECRET_TOKENS = [
  "SERVICE_ROLE",
  "SECRET",
  "PRIVATE_KEY",
  "WEBHOOK_SECRET",
];

function readEnvExample(): string[] {
  const raw = readFileSync(join(repoRoot, ".env.example"), "utf8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("=")[0]!.trim());
}

describe("environment variable hygiene", () => {
  const names = readEnvExample();

  it("declares at least the canonical-domain public vars", () => {
    expect(names).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("never prefixes a secret-looking variable with NEXT_PUBLIC_", () => {
    const leaked = names.filter(
      (name) =>
        name.startsWith("NEXT_PUBLIC_") &&
        SECRET_TOKENS.some((tok) => name.toUpperCase().includes(tok)),
    );
    expect(leaked, `client-exposed secrets: ${leaked.join(", ")}`).toEqual([]);
  });

  it("keeps known service-role / secret keys server-scoped", () => {
    for (const required of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]) {
      expect(names).toContain(required);
      expect(required.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });
});
