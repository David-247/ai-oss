import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AGENT_RULE_CONTROLS,
  LAUNCH_ACCEPTANCE_ITEMS,
  LAUNCH_EXTERNAL_GATES,
  PHASE23_REQUIRED_DOCUMENTS,
  SOURCE_REFERENCE_URLS,
  unresolvedExternalGateIds,
  type EvidenceRef,
} from "./launch-governance";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function absolute(path: string) {
  return join(repoRoot, path);
}

function read(path: string) {
  return readFileSync(absolute(path), "utf8");
}

function expectEvidenceExists(owner: string, evidence: readonly EvidenceRef[]) {
  expect(evidence.length, `${owner} has evidence`).toBeGreaterThan(0);
  for (const item of evidence) {
    expect(existsSync(absolute(item.path)), `${owner}: ${item.path}`).toBe(true);
    expect(item.note.trim().length, `${owner}: ${item.path} note`).toBeGreaterThan(0);
  }
}

function urlsFromPhase30() {
  const source = read("docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md");
  const phase30 = source.split("## 30. Source References Used for Platform and Compliance Decisions")[1] ?? "";
  return Array.from(phase30.matchAll(/https?:\/\/\S+/g), (match) => match[0]);
}

describe("Phase 23 launch acceptance and spec governance", () => {
  it("maps all 25 §28 acceptance criteria to implementation and test evidence", () => {
    expect(LAUNCH_ACCEPTANCE_ITEMS).toHaveLength(25);
    expect(new Set(LAUNCH_ACCEPTANCE_ITEMS.map((item) => item.id)).size).toBe(25);

    for (let i = 1; i <= 25; i += 1) {
      expect(LAUNCH_ACCEPTANCE_ITEMS.map((item) => item.id)).toContain(`28.${i}`);
    }

    for (const item of LAUNCH_ACCEPTANCE_ITEMS) {
      expect(item.criterion.trim().length, item.id).toBeGreaterThan(0);
      expect(item.owningPhases.length, `${item.id} owning phases`).toBeGreaterThan(0);
      expectEvidenceExists(item.id, item.evidence);
      expectEvidenceExists(`${item.id} tests`, item.testEvidence);

      if (item.status === "external-proof-required") {
        expect(item.externalGateIds?.length, `${item.id} external gates`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps public-launch-only blockers explicit instead of marking them green", () => {
    expect(unresolvedExternalGateIds()).toEqual(["counsel-signoff"]);

    const blockedAcceptanceIds = new Set(
      LAUNCH_EXTERNAL_GATES.flatMap((gate) => gate.blocksAcceptanceIds),
    );
    expect([...blockedAcceptanceIds].sort()).toEqual(["28.25"]);

    const followUp = read("phases/FOLLOW-UP.md");
    const launchDoc = read("docs/launch/phase23-launch-acceptance.md");
    for (const gate of LAUNCH_EXTERNAL_GATES) {
      expect(gate.requiredProof.length, `${gate.id} proof`).toBeGreaterThan(0);
      expect(existsSync(absolute(gate.followUpPath)), gate.followUpPath).toBe(true);
      expect(followUp, gate.id).toContain(gate.id);
      expect(launchDoc, gate.id).toContain(gate.id);
    }
  });

  it("maps every architecture §29 development-agent rule to a control and tests", () => {
    expect(AGENT_RULE_CONTROLS).toHaveLength(11);
    expect(new Set(AGENT_RULE_CONTROLS.map((rule) => rule.id)).size).toBe(11);

    const architecture = read("docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md");
    const launchDoc = read("docs/launch/phase23-launch-acceptance.md");
    for (const rule of AGENT_RULE_CONTROLS) {
      expect(rule.rule.trim().length, rule.id).toBeGreaterThan(0);
      expect(rule.control.trim().length, rule.id).toBeGreaterThan(0);
      expectEvidenceExists(rule.id, rule.evidence);
      expectEvidenceExists(`${rule.id} tests`, rule.testEvidence);
      expect(architecture, rule.rule).toContain(rule.rule);
      expect(launchDoc, rule.id).toContain(rule.id);
    }
  });

  it("preserves the §30 source references with a recheck note", () => {
    expect(SOURCE_REFERENCE_URLS).toEqual(urlsFromPhase30());

    const archive = read("docs/architecture/source-references-archive.md");
    expect(archive).toContain("accessed for this architecture on 2026-06-10");
    expect(archive).toContain("MUST be rechecked");
    for (const url of SOURCE_REFERENCE_URLS) {
      expect(archive, url).toContain(url);
    }
  });

  it("wires the Phase 23 meta-test into local and CI QA gates", () => {
    for (const path of PHASE23_REQUIRED_DOCUMENTS) {
      expect(existsSync(absolute(path)), path).toBe(true);
    }

    const prTemplate = read(".github/pull_request_template.md");
    expect(prTemplate).toContain("Requirement Traceability");
    expect(prTemplate).toContain("Requirement IDs / architecture sections");
    expect(prTemplate).toContain("Privacy, permissions, moderation, admin, and compliance-sensitive changes include tests");

    const vitest = read("tests/vitest.config.ts");
    expect(vitest).toContain("phase23/**/*.test.ts");

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("launch-acceptance-gate");
    expect(ci).toContain("phase23/launch-governance.test.ts");
  });
});
