import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const routeContracts = [
  {
    flow: "signup/login/delete",
    files: [
      "apps/web/src/app/api/auth/route.ts",
      "apps/web/src/app/login/page.tsx",
      "apps/web/src/app/account/delete/page.tsx",
      "apps/web/src/app/api/account/delete/route.ts",
    ],
    tokens: ["signup", "logout", "buildAccountDeletionPlan", "privacy_requests"],
  },
  {
    flow: "zone creation",
    files: ["apps/web/src/app/z/new/page.tsx", "apps/web/src/app/api/zones/route.ts"],
    tokens: ["Create zone", "buildZoneInsertRow", "enforceSensitiveAction"],
  },
  {
    flow: "post/comment/vote",
    files: [
      "apps/web/src/app/api/posts/route.ts",
      "apps/web/src/app/api/comments/route.ts",
      "apps/web/src/app/api/votes/route.ts",
    ],
    tokens: ["buildPostInsertRow", "buildCommentInsertRow", "buildVoteUpsertRow"],
  },
  {
    flow: "research submission/publish/version",
    files: [
      "apps/web/src/app/research/submit/page.tsx",
      "apps/web/src/app/api/research/papers/route.ts",
      "apps/web/src/app/api/research/papers/[paperId]/versions/route.ts",
    ],
    tokens: ["Submit paper", "buildPaperInsertRow", "buildPaperVersionInsertRow"],
  },
  {
    flow: "file scan workflow",
    files: [
      "apps/web/src/app/api/files/upload-url/route.ts",
      "apps/web/src/app/api/files/complete/route.ts",
    ],
    tokens: ["validateUploadRequest", "createQuarantinedFileRow", "buildFileScanJob"],
  },
  {
    flow: "chat room join/message",
    files: [
      "apps/web/src/app/api/chat/rooms/route.ts",
      "apps/web/src/app/api/chat/messages/route.ts",
      "apps/web/src/app/api/chat/token/route.ts",
    ],
    tokens: ["buildChatRoomInsertRow", "buildChatMessageInsertRow", "buildRealtimeChannelGrant"],
  },
  {
    flow: "voice token creation",
    files: [
      "apps/web/src/app/api/voice/rooms/route.ts",
      "apps/web/src/app/api/voice/token/route.ts",
    ],
    tokens: ["buildVoiceRoomInsertRow", "buildLiveKitAccessClaims", "evaluateRecordingConsent"],
  },
  {
    flow: "moderation action/appeal",
    files: [
      "apps/web/src/app/api/moderation/actions/route.ts",
      "apps/web/src/app/api/moderation/appeals/route.ts",
      "apps/web/src/app/api/moderation/queue/route.ts",
    ],
    tokens: ["buildModerationActionRow", "buildAppealInsertRow", "buildAppealDecisionPatch"],
  },
  {
    flow: "moderator removal vote",
    files: [
      "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
      "packages/zones/src/index.ts",
    ],
    tokens: ["moderator_removal", "certificationRequired", "voterIdentitiesHidden"],
  },
  {
    flow: "donation checkout/webhook",
    files: [
      "apps/web/src/app/api/stripe/checkout/route.ts",
      "apps/web/src/app/api/stripe/webhook/route.ts",
      "apps/web/src/lib/stripe-server.ts",
    ],
    tokens: ["buildStripeCheckoutSessionParams", "verifyStripeWebhookSignature", "Idempotency-Key"],
  },
  {
    flow: "RLS policies",
    files: [
      "tests/rls/phase-01-static.test.ts",
      "supabase/migrations/20260612010200_phase01_rls.sql",
    ],
    tokens: ["enable row level security", "create policy", "does not grant broad client update"],
  },
] as const;

describe("Phase 22 integration flow contracts", () => {
  it("has a registered route/test artifact for every §27.2 integration flow", () => {
    for (const contract of routeContracts) {
      const combined = contract.files
        .map((path) => {
          const absolute = join(repoRoot, path);
          expect(existsSync(absolute), `${contract.flow}: ${path}`).toBe(true);
          return readFileSync(absolute, "utf8");
        })
        .join("\n");

      for (const token of contract.tokens) {
        expect(combined, `${contract.flow}: ${token}`).toContain(token);
      }
    }
  });
});
