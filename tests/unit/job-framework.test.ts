import { describe, expect, it } from "vitest";
import {
  assertWaitUntilUse,
  calculateBackoffMs,
  createDefaultJobRegistry,
  createInMemoryJobStore,
  DEFAULT_RETRY_POLICY,
  JOB_CATALOG,
  JobRegistry,
  verifyJobTrigger,
  type JobName,
} from "../../packages/jobs/src/index";

const REQUIRED_JOBS = [
  "file_scan",
  "paper_indexing",
  "embedding_generation",
  "moderation_queue_processing",
  "vote_certification",
  "transparency_report_rollup",
  "privacy_export",
  "account_deletion_anonymization",
  "notification_digest",
  "search_maintenance",
] as const satisfies readonly JobName[];

describe("Phase 02 job framework", () => {
  it("registers every required background job stub", () => {
    const registry = createDefaultJobRegistry();
    const names = registry.list().map((job) => job.name);

    expect(Object.keys(JOB_CATALOG).sort()).toEqual([...REQUIRED_JOBS].sort());
    expect(names.sort()).toEqual([...REQUIRED_JOBS].sort());
  });

  it("deduplicates effects by idempotency key", async () => {
    let effects = 0;
    const registry = new JobRegistry(createInMemoryJobStore()).register({
      name: "file_scan",
      runtime: "workflow",
      ownerPhase: "06",
      description: "test job",
      retryPolicy: DEFAULT_RETRY_POLICY,
      handler: () => {
        effects += 1;
        return { effects };
      },
    });

    const first = await registry.run({
      name: "file_scan",
      payload: { file_id: "file-1" },
      idempotencyKey: "file-1",
    });
    const second = await registry.run({
      name: "file_scan",
      payload: { file_id: "file-1" },
      idempotencyKey: "file-1",
    });

    expect(first.status).toBe("succeeded");
    expect(second.duplicate).toBe(true);
    expect(second.result).toEqual(first.result);
    expect(effects).toBe(1);
  });

  it("retries with exponential backoff and dead-letters after exhaustion", async () => {
    const registry = new JobRegistry(createInMemoryJobStore()).register({
      name: "moderation_queue_processing",
      runtime: "queue",
      ownerPhase: "13",
      description: "test failure job",
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 250,
        backoffFactor: 2,
        maxDelayMs: 1_000,
      },
      handler: () => {
        throw new Error("classifier unavailable");
      },
    });

    const run = await registry.run({
      name: "moderation_queue_processing",
      payload: { target_id: "post-1" },
      idempotencyKey: "post-1",
    });

    expect(run.status).toBe("dead_lettered");
    expect(run.attempts.map((attempt) => attempt.delayBeforeNextAttemptMs)).toEqual([
      250,
      500,
      null,
    ]);
    expect(registry.deadLetters()).toHaveLength(1);
    expect(registry.deadLetters()[0]?.reason).toBe("classifier unavailable");
  });

  it("calculates capped retry backoff", () => {
    expect(
      calculateBackoffMs(
        {
          maxAttempts: 5,
          baseDelayMs: 100,
          backoffFactor: 3,
          maxDelayMs: 500,
        },
        3,
      ),
    ).toBe(500);
  });

  it("rejects unsigned cron/workflow triggers", () => {
    expect(
      verifyJobTrigger({
        headers: {},
        secret: "secret",
      }),
    ).toEqual({
      ok: false,
      status: 401,
      reason: "unauthorized_job_trigger",
    });

    expect(
      verifyJobTrigger({
        headers: { authorization: "Bearer secret" },
        secret: "secret",
      }),
    ).toBe(true);
  });

  it("fails closed when the trigger secret is not configured", () => {
    expect(
      verifyJobTrigger({
        headers: { authorization: "Bearer anything" },
        secret: "",
      }),
    ).toEqual({
      ok: false,
      status: 500,
      reason: "missing_job_trigger_secret",
    });
  });

  it("permits waitUntil only for non-critical after-response work", () => {
    expect(() => assertWaitUntilUse("analytics_logging")).not.toThrow();
    expect(() => assertWaitUntilUse("privacy_export")).toThrow(/non-critical after-response work/);
  });
});
