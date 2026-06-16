export const PHASE22_SUITES = [
  "unit",
  "integration",
  "e2e",
  "security",
  "compliance",
] as const;

export type Phase22Suite = (typeof PHASE22_SUITES)[number];

export type TraceabilityEntry = {
  id: string;
  suite: Phase22Suite;
  requirement: string;
  evidence: readonly string[];
};

export const PHASE22_TRACEABILITY = [
  entry("27.1-permission-checks", "unit", "Permission checks", [
    "tests/unit/permission-engine.test.ts",
  ]),
  entry("27.1-automod-rule-parsing", "unit", "AutoMod rule parsing", [
    "tests/unit/moderation-engine.test.ts",
  ]),
  entry("27.1-automod-matching", "unit", "AutoMod matching", [
    "tests/unit/moderation-engine.test.ts",
  ]),
  entry("27.1-vote-uniqueness", "unit", "Vote uniqueness", [
    "tests/unit/discussion-ranking.test.ts",
  ]),
  entry("27.1-ranking-functions", "unit", "Ranking functions", [
    "tests/unit/discussion-ranking.test.ts",
    "tests/unit/research-versioning.test.ts",
  ]),
  entry("27.1-trust-score-updates", "unit", "Trust-score updates", [
    "tests/unit/trust-anti-abuse.test.ts",
  ]),
  entry("27.1-privacy-export-serialization", "unit", "Privacy-export serialization", [
    "tests/unit/auth-privacy.test.ts",
  ]),
  entry("27.1-account-deletion-anonymization", "unit", "Account deletion/anonymization", [
    "tests/unit/auth-privacy.test.ts",
  ]),
  entry("27.1-webhook-idempotency", "unit", "Webhook idempotency", [
    "tests/unit/donations.test.ts",
    "tests/unit/job-framework.test.ts",
  ]),
  entry("27.1-research-versioning", "unit", "Research versioning", [
    "tests/unit/research-versioning.test.ts",
  ]),

  entry("27.2-signup-login-delete", "integration", "Signup/login/delete", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/auth/route.ts",
    "apps/web/src/app/api/account/delete/route.ts",
  ]),
  entry("27.2-zone-creation", "integration", "Zone creation", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/zones/route.ts",
  ]),
  entry("27.2-post-comment-vote", "integration", "Post/comment/vote", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/posts/route.ts",
    "apps/web/src/app/api/comments/route.ts",
    "apps/web/src/app/api/votes/route.ts",
  ]),
  entry(
    "27.2-research-submit-publish-version",
    "integration",
    "Research submission/publish/version",
    [
      "tests/integration/phase22-flow-contracts.test.ts",
      "apps/web/src/app/api/research/papers/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/versions/route.ts",
    ],
  ),
  entry("27.2-file-scan-workflow", "integration", "File scan workflow", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/files/upload-url/route.ts",
    "apps/web/src/app/api/files/complete/route.ts",
  ]),
  entry("27.2-chat-room-join-message", "integration", "Chat room join/message", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/chat/rooms/route.ts",
    "apps/web/src/app/api/chat/messages/route.ts",
    "apps/web/src/app/api/chat/token/route.ts",
  ]),
  entry("27.2-voice-token-creation", "integration", "Voice token creation", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/voice/rooms/route.ts",
    "apps/web/src/app/api/voice/token/route.ts",
  ]),
  entry("27.2-moderation-action-appeal", "integration", "Moderation action/appeal", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/moderation/actions/route.ts",
    "apps/web/src/app/api/moderation/appeals/route.ts",
  ]),
  entry("27.2-moderator-removal-vote", "integration", "Moderator removal vote", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
    "tests/unit/moderator-governance.test.ts",
  ]),
  entry("27.2-donation-checkout-webhook", "integration", "Donation checkout/webhook", [
    "tests/integration/phase22-flow-contracts.test.ts",
    "apps/web/src/app/api/stripe/checkout/route.ts",
    "apps/web/src/app/api/stripe/webhook/route.ts",
  ]),
  entry("27.2-rls-policies", "integration", "RLS policies", [
    "tests/rls/phase-01-static.test.ts",
    "supabase/migrations/20260612010200_phase01_rls.sql",
  ]),

  ...[
    "new-user-onboarding",
    "create-zone",
    "create-post",
    "comment-and-vote",
    "submit-paper",
    "review-paper",
    "join-chat",
    "start-voice-room",
    "report-content",
    "moderator-queue-action",
    "appeal-action",
    "admin-role-grant",
    "account-export",
    "account-deletion",
    "donation",
  ].map((key) =>
    entry(`27.3-${key}`, "e2e", key.replaceAll("-", " "), [
      "tests/e2e/phase22-launch-flows.spec.ts",
    ]),
  ),

  entry("27.4-unauthorized-admin-route", "security", "Unauthorized admin route access", [
    "tests/security/admin-panels.test.ts",
    "tests/security/authorization-audit.test.ts",
  ]),
  entry("27.4-horizontal-privilege-escalation", "security", "Horizontal privilege escalation", [
    "tests/security/authorization-audit.test.ts",
    "tests/security/phase22-security-gate.test.ts",
  ]),
  entry("27.4-rls-bypass-attempts", "security", "RLS bypass attempts", [
    "tests/rls/phase-01-static.test.ts",
  ]),
  entry("27.4-csrf", "security", "CSRF", [
    "tests/unit/security-architecture.test.ts",
    "tests/security/security-architecture.test.ts",
  ]),
  entry("27.4-xss-markdown", "security", "XSS in Markdown", [
    "tests/frontend/design-shell.test.ts",
    "tests/security/phase22-security-gate.test.ts",
  ]),
  entry("27.4-malicious-upload", "security", "Upload malicious-file simulation", [
    "tests/security/file-upload-safety.test.ts",
  ]),
  entry("27.4-webhook-signature-failure", "security", "Webhook signature failure", [
    "tests/security/donations.test.ts",
    "tests/security/phase22-security-gate.test.ts",
  ]),
  entry("27.4-rate-limit-behavior", "security", "Rate-limit behavior", [
    "tests/unit/trust-anti-abuse.test.ts",
    "tests/security/trust-anti-abuse.test.ts",
  ]),
  entry("27.4-bot-challenge-behavior", "security", "Bot-challenge behavior", [
    "tests/unit/trust-anti-abuse.test.ts",
    "tests/security/trust-anti-abuse.test.ts",
  ]),
  entry("27.4-private-zone-search-leakage", "security", "Private-zone search leakage", [
    "tests/security/search-privacy.test.ts",
    "tests/security/phase22-security-gate.test.ts",
  ]),
  entry("27.4-private-chat-leakage", "security", "Private-chat leakage", [
    "tests/security/chat-privacy.test.ts",
    "tests/security/phase22-security-gate.test.ts",
  ]),

  entry("27.5-cookie-consent", "compliance", "Cookie-consent behavior", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "tests/unit/compliance-legal.test.ts",
  ]),
  entry("27.5-privacy-export-due-date", "compliance", "Privacy-export due-date tracking", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "tests/unit/compliance-legal.test.ts",
  ]),
  entry("27.5-deletion-anonymization", "compliance", "Deletion/anonymization", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "tests/unit/auth-privacy.test.ts",
  ]),
  entry("27.5-dmca-notice", "compliance", "DMCA notice workflow", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "apps/web/src/app/api/legal/dmca/route.ts",
  ]),
  entry("27.5-dsa-report-appeal", "compliance", "DSA report+appeal flow", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "apps/web/src/app/api/legal/dsa/route.ts",
  ]),
  entry("27.5-osa-report-redress", "compliance", "OSA report/redress flow", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "apps/web/src/app/api/legal/online-safety/route.ts",
  ]),
  entry("27.5-consent-record-versioning", "compliance", "Consent-record versioning", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "tests/unit/auth-privacy.test.ts",
  ]),
  entry("27.5-terms-acceptance-versioning", "compliance", "Terms-acceptance versioning", [
    "tests/compliance/phase22-compliance-flows.test.ts",
    "apps/web/src/app/signup/page.tsx",
  ]),
] as const satisfies readonly TraceabilityEntry[];

export const PHASE22_CI_GATES = [
  {
    id: "vitest-all",
    command: "pnpm test",
    suites: ["unit", "integration", "security", "compliance"] as const,
  },
  {
    id: "e2e-desktop-mobile",
    command: "pnpm --dir tests test:e2e",
    suites: ["e2e"] as const,
  },
  {
    id: "performance-budgets",
    command: "pnpm --dir tests test -- performance/performance-scalability.test.ts",
    suites: [] as const,
  },
] as const;

export const PHASE22_REQUIRED_IDS = PHASE22_TRACEABILITY.map((entry) => entry.id);

function entry(
  id: string,
  suite: Phase22Suite,
  requirement: string,
  evidence: readonly string[],
): TraceabilityEntry {
  return { id, suite, requirement, evidence };
}
