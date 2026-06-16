export type LaunchEvidenceStatus =
  | "verified-local"
  | "verified-current-external"
  | "external-proof-required";

export interface EvidenceRef {
  path: string;
  note: string;
}

export interface LaunchAcceptanceItem {
  id: string;
  criterion: string;
  owningPhases: readonly string[];
  status: LaunchEvidenceStatus;
  evidence: readonly EvidenceRef[];
  testEvidence: readonly EvidenceRef[];
  externalGateIds?: readonly string[];
}

export interface AgentRuleControl {
  id: string;
  rule: string;
  control: string;
  evidence: readonly EvidenceRef[];
  testEvidence: readonly EvidenceRef[];
}

export interface ExternalLaunchGate {
  id: string;
  title: string;
  blocksAcceptanceIds: readonly string[];
  requiredProof: readonly string[];
  followUpPath: string;
}

function ref(path: string, note: string): EvidenceRef {
  return { path, note };
}

export const LAUNCH_EXTERNAL_GATES = [
  {
    id: "counsel-signoff",
    title: "Qualified counsel approval before public launch",
    blocksAcceptanceIds: ["28.25"],
    requiredProof: [
      "Dated approval for Terms, Privacy Policy, Community Guidelines, Research Publishing Policy, DMCA policy, DSA/OSA flows, cookie/consent behavior, age policy, DPAs, and retention schedule.",
      "Named approving counsel or firm and owner acknowledgement.",
      "Launch decision record stored outside public client bundles.",
    ],
    followUpPath: "phases/FOLLOW-UP.md",
  },
] as const satisfies readonly ExternalLaunchGate[];

export const LAUNCH_ACCEPTANCE_ITEMS = [
  {
    id: "28.1",
    criterion: "https://www.ai-oss.net/ deployed on Vercel with apex redirect.",
    owningPhases: ["00", "19", "23"],
    status: "verified-current-external",
    evidence: [
      ref("docs/launch/production-domain-verification.md", "Current public Vercel and apex redirect verification."),
      ref("apps/web/vercel.json", "Next.js Vercel project configuration."),
      ref("apps/web/src/lib/canonical.ts", "REQ-CORE-002 apex-to-www redirect logic."),
      ref("apps/web/src/middleware.ts", "Middleware applies canonical redirects and security headers."),
    ],
    testEvidence: [
      ref("tests/integration/canonical-redirect.test.ts", "Apex redirect unit coverage."),
    ],
  },
  {
    id: "28.2",
    criterion: "Users can create, authenticate, secure, export, and delete accounts.",
    owningPhases: ["03", "18", "22"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/signup/page.tsx", "Signup and launch consent UI."),
      ref("apps/web/src/app/login/page.tsx", "Login UI."),
      ref("apps/web/src/app/account/export/page.tsx", "Account export page."),
      ref("apps/web/src/app/account/delete/page.tsx", "Account deletion page."),
      ref("apps/web/src/app/api/auth/route.ts", "Auth route handlers."),
      ref("apps/web/src/app/api/account/export/route.ts", "Privacy export route."),
      ref("apps/web/src/app/api/account/delete/route.ts", "Deletion route."),
    ],
    testEvidence: [
      ref("tests/unit/auth-privacy.test.ts", "Privacy export and deletion unit coverage."),
      ref("tests/compliance/phase22-compliance-flows.test.ts", "Privacy and deletion compliance coverage."),
      ref("tests/e2e/phase22-launch-flows.spec.ts", "Signup/export/delete E2E smoke."),
    ],
  },
  {
    id: "28.3",
    criterion: "Users can create zones and participate in Reddit-like posts/comments/votes.",
    owningPhases: ["07", "08", "22"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/z/new/page.tsx", "Zone creation page."),
      ref("apps/web/src/app/api/zones/route.ts", "Zone API."),
      ref("apps/web/src/app/api/posts/route.ts", "Post API."),
      ref("apps/web/src/app/api/comments/route.ts", "Comment API."),
      ref("apps/web/src/app/api/votes/route.ts", "Vote API."),
      ref("packages/discussions/src/index.ts", "Discussion rows and ranking helpers."),
    ],
    testEvidence: [
      ref("tests/unit/zone-policy.test.ts", "Zone policy coverage."),
      ref("tests/unit/discussion-ranking.test.ts", "Posts/comments/votes/ranking coverage."),
      ref("tests/integration/phase22-flow-contracts.test.ts", "Zone and contribution route contracts."),
    ],
  },
  {
    id: "28.4",
    criterion: "Zones have rules, moderators, modmail, AutoMod, chat, voice, and governance.",
    owningPhases: ["07", "10", "11", "13", "15"],
    status: "verified-local",
    evidence: [
      ref("packages/zones/src/index.ts", "Zone rules, roles, governance, and moderator helpers."),
      ref("packages/moderation/src/index.ts", "AutoMod and moderation primitives."),
      ref("packages/chat/src/index.ts", "Chat room primitives."),
      ref("packages/voice/src/index.ts", "Voice room primitives."),
      ref("apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts", "Governance actions API."),
    ],
    testEvidence: [
      ref("tests/unit/zone-policy.test.ts", "Zone features and governance coverage."),
      ref("tests/unit/moderation-engine.test.ts", "AutoMod coverage."),
      ref("tests/unit/chat-framework.test.ts", "Chat coverage."),
      ref("tests/unit/voice-framework.test.ts", "Voice coverage."),
      ref("tests/unit/moderator-governance.test.ts", "Moderator governance coverage."),
    ],
  },
  {
    id: "28.5",
    criterion: "Users can submit full research papers with immutable versions.",
    owningPhases: ["09", "22"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/research/submit/page.tsx", "Paper submission UI."),
      ref("apps/web/src/app/api/research/papers/route.ts", "Paper submission API."),
      ref("apps/web/src/app/api/research/papers/[paperId]/versions/route.ts", "Version creation API."),
      ref("packages/research/src/index.ts", "Research paper and version helpers."),
    ],
    testEvidence: [
      ref("tests/unit/research-versioning.test.ts", "Immutable paper version unit coverage."),
      ref("tests/security/research-publishing.test.ts", "Append-only version security coverage."),
    ],
  },
  {
    id: "28.6",
    criterion: "Research papers have pages, files, full text, comments, votes, reviews, and replication reports.",
    owningPhases: ["06", "08", "09"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/research/[paperId]/[[...section]]/page.tsx", "Paper page route."),
      ref("apps/web/src/app/api/research/papers/[paperId]/files/route.ts", "Paper file API."),
      ref("apps/web/src/app/api/research/papers/[paperId]/reviews/route.ts", "Review API."),
      ref("apps/web/src/app/api/research/papers/[paperId]/replications/route.ts", "Replication report API."),
      ref("apps/web/src/app/api/comments/route.ts", "Research comments API."),
      ref("apps/web/src/app/api/votes/route.ts", "Research votes API."),
    ],
    testEvidence: [
      ref("tests/unit/research-versioning.test.ts", "Research page/version metadata coverage."),
      ref("tests/unit/file-pipeline.test.ts", "Paper file coverage."),
      ref("tests/integration/phase22-flow-contracts.test.ts", "Research route contracts."),
    ],
  },
  {
    id: "28.7",
    criterion: "Search works across public/authorized content with keyword and semantic search.",
    owningPhases: ["12", "21"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/search/page.tsx", "Search UI."),
      ref("apps/web/src/app/api/search/route.ts", "Search API."),
      ref("packages/search/src/index.ts", "Hybrid keyword/semantic search helpers."),
      ref("supabase/migrations/20260612011200_phase12_search_architecture.sql", "Search document and vector schema."),
    ],
    testEvidence: [
      ref("tests/unit/search-architecture.test.ts", "Search architecture unit coverage."),
      ref("tests/security/search-privacy.test.ts", "Authorized-content leakage checks."),
      ref("tests/performance/performance-scalability.test.ts", "Search hot-path and pagination checks."),
    ],
  },
  {
    id: "28.8",
    criterion: "Realtime text chat works with membership authorization and moderation.",
    owningPhases: ["10", "13"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/messages/page.tsx", "Chat UI shell."),
      ref("apps/web/src/app/api/chat/rooms/route.ts", "Chat room API."),
      ref("apps/web/src/app/api/chat/messages/route.ts", "Message API."),
      ref("apps/web/src/app/api/chat/token/route.ts", "Realtime channel grant API."),
      ref("packages/chat/src/index.ts", "Chat membership and message helpers."),
    ],
    testEvidence: [
      ref("tests/unit/chat-framework.test.ts", "Chat unit coverage."),
      ref("tests/security/chat-privacy.test.ts", "Chat privacy and authorization checks."),
      ref("tests/integration/phase22-flow-contracts.test.ts", "Chat route contracts."),
    ],
  },
  {
    id: "28.9",
    criterion: "Voice rooms work through WebRTC provider with host/mod controls.",
    owningPhases: ["11", "20"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/z/[zoneSlug]/voice/[roomId]/page.tsx", "Voice room UI."),
      ref("apps/web/src/app/api/voice/rooms/route.ts", "Voice room API."),
      ref("apps/web/src/app/api/voice/token/route.ts", "LiveKit token API."),
      ref("apps/web/src/lib/voice-server.ts", "LiveKit server integration helpers."),
      ref("packages/voice/src/index.ts", "Voice room controls and claims."),
    ],
    testEvidence: [
      ref("tests/unit/voice-framework.test.ts", "Voice unit coverage."),
      ref("tests/security/voice-privacy.test.ts", "Recording/privacy checks."),
      ref("tests/e2e/phase22-launch-flows.spec.ts", "Voice room E2E smoke."),
    ],
  },
  {
    id: "28.10",
    criterion: "Donations work through Stripe with verified webhooks.",
    owningPhases: ["17", "19"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/donate/page.tsx", "Donation UI."),
      ref("apps/web/src/app/api/stripe/checkout/route.ts", "Stripe checkout route."),
      ref("apps/web/src/app/api/stripe/webhook/route.ts", "Stripe webhook route."),
      ref("apps/web/src/lib/stripe-server.ts", "Stripe signing and webhook processing helpers."),
      ref("packages/donations/src/index.ts", "Donation and Stripe event helpers."),
    ],
    testEvidence: [
      ref("tests/unit/donations.test.ts", "Donation and webhook unit coverage."),
      ref("tests/security/donations.test.ts", "Donation privilege and webhook security checks."),
      ref("tests/security/phase22-security-gate.test.ts", "Webhook signature failure gate."),
    ],
  },
  {
    id: "28.11",
    criterion: "Admin panels exist for users, roles, zones, content, research, AutoMod, appeals, legal/privacy, security, donations, analytics, audit logs, and system health.",
    owningPhases: ["16", "20", "21"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/admin/[[...section]]/page.tsx", "Admin panel page."),
      ref("apps/web/src/app/api/admin/route.ts", "Admin root API."),
      ref("apps/web/src/app/api/admin/[...panel]/route.ts", "Admin panel API."),
      ref("packages/admin/src/index.ts", "Admin panel registry and action catalog."),
      ref("apps/web/src/lib/admin-server.ts", "Admin data and action handlers."),
    ],
    testEvidence: [
      ref("tests/unit/admin-panels.test.ts", "Admin panel unit coverage."),
      ref("tests/security/admin-panels.test.ts", "Admin route and panel security checks."),
      ref("tests/security/observability-operations.test.ts", "System health/admin observability checks."),
    ],
  },
  {
    id: "28.12",
    criterion: "Custom admin roles and permissions are supported.",
    owningPhases: ["04", "16"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/api/admin/roles/route.ts", "Admin role mutation API."),
      ref("apps/web/src/lib/permissions-server.ts", "Custom role parsing and permission audit helpers."),
      ref("packages/permissions/src/index.ts", "RBAC/ABAC permission engine."),
      ref("packages/admin/src/index.ts", "Role admin panel descriptors."),
    ],
    testEvidence: [
      ref("tests/unit/permission-engine.test.ts", "Permission engine and high-risk action coverage."),
      ref("tests/unit/admin-panels.test.ts", "Custom role admin coverage."),
      ref("tests/security/authorization-audit.test.ts", "Permission audit coverage."),
    ],
  },
  {
    id: "28.13",
    criterion: "Moderator tiers are supported.",
    owningPhases: ["15"],
    status: "verified-local",
    evidence: [
      ref("packages/zones/src/index.ts", "Moderator tier definitions and assignment helpers."),
      ref("supabase/migrations/20260612011500_phase15_moderator_governance.sql", "Moderator tier schema."),
      ref("apps/web/src/app/api/zones/[zoneId]/moderators/route.ts", "Moderator API."),
    ],
    testEvidence: [
      ref("tests/unit/moderator-governance.test.ts", "Moderator tier unit coverage."),
      ref("tests/security/moderator-governance.test.ts", "Moderator governance security checks."),
    ],
  },
  {
    id: "28.14",
    criterion: "Moderator removal by community vote exists and includes anti-bot certification.",
    owningPhases: ["14", "15"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts", "Moderator removal and governance route."),
      ref("packages/zones/src/index.ts", "Governance petition, ballot, and certification helpers."),
      ref("packages/trust/src/index.ts", "Anti-bot trust and certification signals."),
    ],
    testEvidence: [
      ref("tests/unit/moderator-governance.test.ts", "Removal vote and certification coverage."),
      ref("tests/security/moderator-governance.test.ts", "Governance privacy and override checks."),
      ref("tests/security/trust-anti-abuse.test.ts", "Anti-abuse governance mitigation checks."),
    ],
  },
  {
    id: "28.15",
    criterion: "AutoMod rules can be created, tested, versioned, published, and rolled back.",
    owningPhases: ["13", "16"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/api/moderation/automod/rules/route.ts", "AutoMod rule API."),
      ref("apps/web/src/app/api/moderation/automod/test/route.ts", "AutoMod test API."),
      ref("packages/moderation/src/index.ts", "Rule lifecycle helpers."),
      ref("packages/admin/src/index.ts", "AutoMod admin descriptors."),
    ],
    testEvidence: [
      ref("tests/unit/moderation-engine.test.ts", "AutoMod unit coverage."),
      ref("tests/security/moderation-workflow.test.ts", "AutoMod lifecycle permission/audit coverage."),
      ref("tests/unit/admin-panels.test.ts", "Admin AutoMod panel coverage."),
    ],
  },
  {
    id: "28.16",
    criterion: "Reports, moderation actions, and appeals work.",
    owningPhases: ["13"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/api/reports/route.ts", "Report API."),
      ref("apps/web/src/app/api/moderation/actions/route.ts", "Moderation action API."),
      ref("apps/web/src/app/api/moderation/appeals/route.ts", "Appeal API."),
      ref("apps/web/src/app/api/moderation/queue/route.ts", "Moderation queue API."),
      ref("packages/moderation/src/index.ts", "Report/action/appeal helpers."),
    ],
    testEvidence: [
      ref("tests/unit/moderation-engine.test.ts", "Report/action/appeal unit coverage."),
      ref("tests/security/moderation-workflow.test.ts", "Moderation workflow security coverage."),
      ref("tests/integration/phase22-flow-contracts.test.ts", "Moderation route contracts."),
    ],
  },
  {
    id: "28.17",
    criterion: "DSA/OSA-compatible notice, reason, and appeal data is captured.",
    owningPhases: ["18", "13"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/api/legal/dsa/route.ts", "DSA legal intake API."),
      ref("apps/web/src/app/api/legal/online-safety/route.ts", "OSA legal intake API."),
      ref("packages/compliance/src/index.ts", "DSA/OSA legal request builders."),
      ref("apps/web/src/lib/admin-server.ts", "Statement-of-reasons and legal admin handling."),
    ],
    testEvidence: [
      ref("tests/unit/compliance-legal.test.ts", "DSA/OSA compliance unit coverage."),
      ref("tests/compliance/phase22-compliance-flows.test.ts", "DSA/OSA compliance flow coverage."),
      ref("tests/security/compliance-legal.test.ts", "Legal/admin security coverage."),
    ],
  },
  {
    id: "28.18",
    criterion: "DMCA workflow exists.",
    owningPhases: ["18"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/api/legal/dmca/route.ts", "DMCA intake API."),
      ref("apps/web/src/app/legal/[slug]/page.tsx", "DMCA policy page route."),
      ref("packages/compliance/src/index.ts", "DMCA legal request model."),
      ref("docs/runbooks/dmca-takedown.md", "DMCA takedown runbook."),
    ],
    testEvidence: [
      ref("tests/unit/compliance-legal.test.ts", "DMCA unit coverage."),
      ref("tests/compliance/phase22-compliance-flows.test.ts", "DMCA flow coverage."),
      ref("tests/security/compliance-legal.test.ts", "Legal surface security coverage."),
    ],
  },
  {
    id: "28.19",
    criterion: "Privacy export/deletion workflows exist.",
    owningPhases: ["03", "18"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/account/export/page.tsx", "Privacy export UI."),
      ref("apps/web/src/app/account/delete/page.tsx", "Account deletion UI."),
      ref("apps/web/src/app/api/account/export/route.ts", "Export API."),
      ref("apps/web/src/app/api/account/delete/route.ts", "Deletion API."),
      ref("docs/runbooks/privacy-deletion-export.md", "Privacy export/deletion runbook."),
    ],
    testEvidence: [
      ref("tests/unit/auth-privacy.test.ts", "Export/delete unit coverage."),
      ref("tests/compliance/phase22-compliance-flows.test.ts", "Privacy workflow compliance coverage."),
      ref("tests/e2e/phase22-launch-flows.spec.ts", "Export/delete E2E smoke."),
    ],
  },
  {
    id: "28.20",
    criterion: "Audit logs are append-only at application level.",
    owningPhases: ["04", "19", "20"],
    status: "verified-local",
    evidence: [
      ref("supabase/migrations/20260612010100_phase01_schema.sql", "Append-only trigger for audit tables."),
      ref("apps/web/src/lib/permissions-server.ts", "Audit event insertion helper."),
      ref("packages/db/src/index.ts", "Protected audit table metadata."),
    ],
    testEvidence: [
      ref("tests/security/authorization-audit.test.ts", "Append-only audit event coverage."),
      ref("tests/security/security-architecture.test.ts", "Security event append-only coverage."),
      ref("tests/security/observability-operations.test.ts", "Observability append-only coverage."),
    ],
  },
  {
    id: "28.21",
    criterion: "Security headers, WAF, rate limiting, and bot controls are configured.",
    owningPhases: ["14", "19", "21"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/middleware.ts", "Security headers and CSRF middleware."),
      ref("packages/security/src/index.ts", "Security headers, CSRF, SSRF, and WAF control helpers."),
      ref("packages/trust/src/index.ts", "Rate-limit and bot-challenge helpers."),
      ref("vercel/waf-rules.phase19.json", "Vercel WAF rule catalog."),
    ],
    testEvidence: [
      ref("tests/unit/security-architecture.test.ts", "Security architecture unit coverage."),
      ref("tests/security/security-architecture.test.ts", "Security headers/WAF checks."),
      ref("tests/unit/trust-anti-abuse.test.ts", "Rate-limit and bot controls coverage."),
      ref("tests/security/trust-anti-abuse.test.ts", "Anti-abuse security checks."),
    ],
  },
  {
    id: "28.22",
    criterion: "Accessibility checks pass.",
    owningPhases: ["05", "22"],
    status: "verified-local",
    evidence: [
      ref("apps/web/src/app/layout.tsx", "Accessible app shell and skip link target."),
      ref("apps/web/src/app/globals.css", "Responsive/focus styling."),
      ref("packages/design-system/src/index.ts", "Navigation and legal route descriptors."),
    ],
    testEvidence: [
      ref("tests/frontend/design-shell.test.ts", "Frontend shell/accessibility static checks."),
      ref("tests/e2e/phase22-launch-flows.spec.ts", "Desktop/mobile page smoke and overflow checks."),
    ],
  },
  {
    id: "28.23",
    criterion: "RLS tests pass.",
    owningPhases: ["01", "22"],
    status: "verified-local",
    evidence: [
      ref("supabase/migrations/20260612010200_phase01_rls.sql", "RLS policy migration."),
      ref("supabase/policies/phase01_rls.sql", "RLS policy reference copy."),
    ],
    testEvidence: [
      ref("tests/rls/phase-01-static.test.ts", "RLS static test suite."),
    ],
  },
  {
    id: "28.24",
    criterion: "E2E tests pass for core flows.",
    owningPhases: ["22"],
    status: "verified-local",
    evidence: [
      ref("tests/playwright.config.ts", "Desktop/mobile Playwright configuration."),
      ref("tests/e2e/phase22-launch-flows.spec.ts", "Core launch E2E flow smoke tests."),
      ref(".github/workflows/ci.yml", "CI E2E job wiring."),
    ],
    testEvidence: [
      ref("tests/phase22/traceability.test.ts", "QA suite and CI traceability checks."),
      ref("tests/e2e/phase22-launch-flows.spec.ts", "Core E2E flow tests."),
    ],
  },
  {
    id: "28.25",
    criterion: "Legal/privacy documents are present and approved by counsel before public launch.",
    owningPhases: ["18", "23"],
    status: "external-proof-required",
    externalGateIds: ["counsel-signoff"],
    evidence: [
      ref("packages/compliance/src/index.ts", "Versioned legal policy registry."),
      ref("apps/web/src/app/legal/page.tsx", "Legal index page."),
      ref("apps/web/src/app/legal/[slug]/page.tsx", "Legal policy page route."),
      ref("docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md", "Counsel review requirement in §23 and §28."),
    ],
    testEvidence: [
      ref("tests/unit/compliance-legal.test.ts", "Legal document registry coverage."),
      ref("tests/security/compliance-legal.test.ts", "Legal/admin security coverage."),
      ref("tests/compliance/phase22-compliance-flows.test.ts", "Compliance flow coverage."),
    ],
  },
] as const satisfies readonly LaunchAcceptanceItem[];

export const AGENT_RULE_CONTROLS = [
  {
    id: "29.1",
    rule: "Treat this file as the source of truth.",
    control: "Phase README and Phase 23 launch manifest bind evidence back to the architecture source.",
    evidence: [
      ref("phases/README.md", "Architecture authority and phase coverage matrix."),
      ref("docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md", "Controlling source document."),
      ref("docs/launch/phase23-launch-acceptance.md", "Phase 23 launch-governance checklist."),
    ],
    testEvidence: [
      ref("tests/phase23/launch-governance.test.ts", "Source-of-truth governance meta-test."),
    ],
  },
  {
    id: "29.2",
    rule: "Implement requirements with traceable IDs in issues/PRs.",
    control: "Traceability convention and PR template require requirement IDs.",
    evidence: [
      ref("docs/architecture/traceability.md", "Requirement-ID convention."),
      ref(".github/pull_request_template.md", "PR requirement ID checklist."),
    ],
    testEvidence: [
      ref("tests/phase22/traceability.test.ts", "Traceability report coverage."),
      ref("tests/phase23/launch-governance.test.ts", "Phase 23 rule mapping coverage."),
    ],
  },
  {
    id: "29.3",
    rule: "Never remove compliance, moderation, privacy, or admin scope as “later.”",
    control: "Launch checklist requires those surfaces and Phase 22/23 tests map them to evidence.",
    evidence: [
      ref("docs/testing/phase22-traceability.md", "Compliance/moderation/privacy/admin QA map."),
      ref("docs/launch/phase23-launch-acceptance.md", "Launch checklist entries for required surfaces."),
      ref("packages/admin/src/index.ts", "Admin panel registry."),
      ref("packages/compliance/src/index.ts", "Compliance policy and request registry."),
      ref("packages/moderation/src/index.ts", "Moderation system."),
    ],
    testEvidence: [
      ref("tests/security/admin-panels.test.ts", "Admin scope checks."),
      ref("tests/security/moderation-workflow.test.ts", "Moderation scope checks."),
      ref("tests/compliance/phase22-compliance-flows.test.ts", "Compliance/privacy scope checks."),
    ],
  },
  {
    id: "29.4",
    rule: "Never store service-role keys client-side.",
    control: "Environment hygiene tests and server-only auth helpers guard service-role use.",
    evidence: [
      ref(".env.example", "Server-only service-role environment naming."),
      ref("apps/web/src/lib/auth-server.ts", "Server-side service client helper."),
      ref("apps/web/src/middleware.ts", "Client-safe middleware boundary."),
    ],
    testEvidence: [
      ref("tests/security/env-hygiene.test.ts", "Service-role exposure checks."),
      ref("tests/security/observability-operations.test.ts", "No service-role leak checks."),
    ],
  },
  {
    id: "29.5",
    rule: "Never bypass RLS by exposing admin APIs to clients.",
    control: "Admin routes are server-side permission-gated and RLS policy tests remain required.",
    evidence: [
      ref("apps/web/src/app/api/admin/route.ts", "Server-side admin route."),
      ref("apps/web/src/app/api/admin/[...panel]/route.ts", "Server-side admin panel route."),
      ref("apps/web/src/lib/admin-server.ts", "Admin permission checks."),
      ref("supabase/migrations/20260612010200_phase01_rls.sql", "RLS policy migration."),
    ],
    testEvidence: [
      ref("tests/security/admin-panels.test.ts", "Admin API server-side checks."),
      ref("tests/security/authorization-audit.test.ts", "Permission/audit checks."),
      ref("tests/rls/phase-01-static.test.ts", "RLS tests."),
    ],
  },
  {
    id: "29.6",
    rule: "Never create unaudited admin/moderation actions.",
    control: "Admin/moderation actions call audit helpers and append-only audit tables exist.",
    evidence: [
      ref("apps/web/src/lib/admin-server.ts", "Admin audit insertion."),
      ref("apps/web/src/lib/moderation-server.ts", "Moderation audit helpers."),
      ref("supabase/migrations/20260612010100_phase01_schema.sql", "Append-only audit triggers."),
    ],
    testEvidence: [
      ref("tests/unit/admin-panels.test.ts", "Admin action audit descriptors."),
      ref("tests/security/moderation-workflow.test.ts", "Moderation audit checks."),
      ref("tests/security/authorization-audit.test.ts", "Append-only audit coverage."),
    ],
  },
  {
    id: "29.7",
    rule: "Never make donation status affect governance or ranking.",
    control: "Donation grants no privileges and governance excludes donation weighting.",
    evidence: [
      ref("packages/donations/src/index.ts", "Donation no-privilege grant helper."),
      ref("packages/zones/src/index.ts", "Governance donation exclusion metadata."),
      ref("packages/trust/src/index.ts", "Trust model keeps donations out of privilege calculations."),
    ],
    testEvidence: [
      ref("tests/unit/donations.test.ts", "No-privilege donation unit coverage."),
      ref("tests/security/donations.test.ts", "Donation privilege security checks."),
      ref("tests/unit/moderator-governance.test.ts", "Governance donation exclusion coverage."),
    ],
  },
  {
    id: "29.8",
    rule: "Never make recording/transcription default for voice.",
    control: "Voice helpers default recording/transcription off and require consent/indicator metadata.",
    evidence: [
      ref("packages/voice/src/index.ts", "Voice recording/transcription defaults."),
      ref("apps/web/src/app/z/[zoneSlug]/voice/[roomId]/page.tsx", "Pre-join consent UI."),
      ref("apps/web/src/app/api/voice/token/route.ts", "Voice token consent claims."),
    ],
    testEvidence: [
      ref("tests/security/voice-privacy.test.ts", "Recording/transcription default checks."),
      ref("tests/unit/voice-framework.test.ts", "Voice consent and claim coverage."),
    ],
  },
  {
    id: "29.9",
    rule: "Never silently overwrite published paper versions.",
    control: "Research version APIs insert new versions and file helpers block same-version overwrite.",
    evidence: [
      ref("apps/web/src/app/api/research/papers/[paperId]/versions/route.ts", "Append-only version route."),
      ref("packages/research/src/index.ts", "Version row builders."),
      ref("packages/files/src/index.ts", "Immutable paper file key helpers."),
    ],
    testEvidence: [
      ref("tests/unit/research-versioning.test.ts", "Versioning unit coverage."),
      ref("tests/security/research-publishing.test.ts", "Append-only version security checks."),
      ref("tests/security/file-upload-safety.test.ts", "Published file overwrite prevention."),
    ],
  },
  {
    id: "29.10",
    rule: "Never weaken global moderation rules at zone level.",
    control: "AutoMod layering keeps global rules effective and moderation security tests cover lifecycle changes.",
    evidence: [
      ref("packages/moderation/src/index.ts", "AutoMod global/zone rule layering."),
      ref("apps/web/src/app/api/moderation/automod/rules/route.ts", "AutoMod rule mutation route."),
    ],
    testEvidence: [
      ref("tests/unit/moderation-engine.test.ts", "Global/zone AutoMod layering coverage."),
      ref("tests/security/moderation-workflow.test.ts", "AutoMod lifecycle permission/audit checks."),
    ],
  },
  {
    id: "29.11",
    rule: "Always add tests for privacy, permissions, and moderation-sensitive changes.",
    control: "Vitest includes privacy/compliance, permission/RLS, moderation, security, and Phase 22/23 meta suites.",
    evidence: [
      ref("tests/vitest.config.ts", "QA suite include list."),
      ref("docs/testing/phase22-traceability.md", "Phase 22 test coverage map."),
      ref("docs/launch/phase23-launch-acceptance.md", "Phase 23 launch gate map."),
    ],
    testEvidence: [
      ref("tests/compliance/phase22-compliance-flows.test.ts", "Privacy/compliance tests."),
      ref("tests/unit/permission-engine.test.ts", "Permission tests."),
      ref("tests/unit/moderation-engine.test.ts", "Moderation tests."),
      ref("tests/phase23/launch-governance.test.ts", "Phase 23 meta-test."),
    ],
  },
] as const satisfies readonly AgentRuleControl[];

export const SOURCE_REFERENCE_URLS = [
  "https://vercel.com/docs/storage",
  "https://vercel.com/docs/marketplace-storage",
  "https://vercel.com/marketplace",
  "https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication",
  "https://vercel.com/docs/frameworks/backend",
  "https://vercel.com/docs/functions",
  "https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting",
  "https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules",
  "https://vercel.com/docs/botid",
  "https://vercel.com/docs/workflows",
  "https://vercel.com/docs/queues",
  "https://vercel.com/docs/cron-jobs",
  "https://vercel.com/marketplace/stripe",
  "https://supabase.com/docs",
  "https://supabase.com/docs/guides/database/postgres/row-level-security",
  "https://supabase.com/docs/guides/realtime",
  "https://supabase.com/docs/guides/storage/security/access-control",
  "https://supabase.com/docs/reference/javascript/auth-admin-deleteuser",
  "https://supabase.com/docs/guides/database/full-text-search",
  "https://supabase.com/docs/guides/ai",
  "https://supabase.com/docs/guides/ai/semantic-search",
  "https://docs.livekit.io/transport/sdk-platforms/react/",
  "https://livekit.com/",
  "https://support.reddithelp.com/hc/en-us/articles/15484574206484-Automoderator",
  "https://www.reddit.com/r/reddit.com/wiki/automoderator/full-documentation/",
  "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en",
  "https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en",
  "https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/eu-us-data-transfers_en",
  "https://www.gov.uk/data-protection",
  "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/",
  "https://ico.org.uk/for-the-public/online/cookies/",
  "https://oag.ca.gov/privacy/ccpa",
  "https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa",
  "https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy",
  "https://www.copyright.gov/512/",
  "https://digital-strategy.ec.europa.eu/en/policies/digital-services-act",
  "https://digital-strategy.ec.europa.eu/en/policies/dsa-notice-and-action-mechanism",
  "https://digital-strategy.ec.europa.eu/en/policies/dsa-out-court-dispute-settlement",
  "https://www.gov.uk/government/publications/online-safety-act-explainer/online-safety-act-explainer",
  "https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/illegal-content-duties-under-the-online-safety-act",
  "https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/statement-protecting-people-from-illegal-harms-online",
  "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
  "https://digital-strategy.ec.europa.eu/en/faqs/general-purpose-ai-models-ai-act-questions-answers",
] as const;

export const PHASE23_REQUIRED_DOCUMENTS = [
  "docs/launch/phase23-launch-acceptance.md",
  "docs/architecture/source-references-archive.md",
  "phases/FOLLOW-UP.md",
] as const;

export function unresolvedExternalGateIds(items: readonly LaunchAcceptanceItem[] = LAUNCH_ACCEPTANCE_ITEMS) {
  const gateIds = new Set<string>();
  for (const item of items) {
    if (item.status === "external-proof-required") {
      for (const gateId of item.externalGateIds ?? []) {
        gateIds.add(gateId);
      }
    }
  }
  return [...gateIds].sort();
}
