import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PHASE22_CI_GATES,
  PHASE22_REQUIRED_IDS,
  PHASE22_SUITES,
  PHASE22_TRACEABILITY,
} from "./traceability";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Phase 22 QA traceability", () => {
  it("maps every required §27 item to a concrete suite and evidence file", () => {
    expect(new Set(PHASE22_REQUIRED_IDS).size).toBe(PHASE22_REQUIRED_IDS.length);

    for (const suite of PHASE22_SUITES) {
      expect(PHASE22_TRACEABILITY.some((entry) => entry.suite === suite)).toBe(true);
    }

    for (const entry of PHASE22_TRACEABILITY) {
      expect(entry.evidence.length).toBeGreaterThan(0);
      for (const evidencePath of entry.evidence) {
        expect(existsSync(join(repoRoot, evidencePath)), `${entry.id}: ${evidencePath}`).toBe(true);
      }
    }
  });

  it("keeps Vitest and CI wired to every non-browser QA suite", () => {
    const vitest = read("tests/vitest.config.ts");
    for (const folder of ["unit", "integration", "frontend", "security", "compliance", "rls", "performance"]) {
      expect(vitest).toContain(`${folder}/**/*.test.ts`);
    }

    const ci = read(".github/workflows/ci.yml");
    for (const gate of PHASE22_CI_GATES) {
      expect(ci).toContain(gate.id);
      expect(ci).toContain(gate.command);
    }
    expect(ci).toContain("launch-acceptance-gate");
  });

  it("publishes a human-readable traceability report for the launch gate", () => {
    const report = read("docs/testing/phase22-traceability.md");
    for (const entry of PHASE22_TRACEABILITY) {
      expect(report).toContain(entry.id);
      expect(report).toContain(entry.requirement);
    }
  });
});
