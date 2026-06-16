export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export type JsonRecord = { [key: string]: JsonValue | undefined };

export const JOB_CATALOG = {
  file_scan: {
    ownerPhase: "06",
    runtime: "workflow",
    description: "Scan uploaded files before release from quarantine.",
  },
  paper_indexing: {
    ownerPhase: "09/12",
    runtime: "workflow",
    description: "Index paper metadata, full text, and version snapshots.",
  },
  embedding_generation: {
    ownerPhase: "12",
    runtime: "queue",
    description: "Generate and refresh semantic embeddings.",
  },
  moderation_queue_processing: {
    ownerPhase: "13",
    runtime: "queue",
    description: "Process automoderation and moderation queue events.",
  },
  vote_certification: {
    ownerPhase: "08/14",
    runtime: "queue",
    description: "Certify votes after anti-abuse checks.",
  },
  transparency_report_rollup: {
    ownerPhase: "18",
    runtime: "cron",
    description: "Roll up transparency report events.",
  },
  privacy_export: {
    ownerPhase: "03/18",
    runtime: "workflow",
    description: "Build user data export archives.",
  },
  account_deletion_anonymization: {
    ownerPhase: "03/18",
    runtime: "workflow",
    description: "Delete/anonymize account data under retention rules.",
  },
  notification_digest: {
    ownerPhase: "03",
    runtime: "cron",
    description: "Send notification digest emails.",
  },
  search_maintenance: {
    ownerPhase: "12",
    runtime: "cron",
    description: "Refresh search indexes and remove stale documents.",
  },
} as const;

export type JobName = keyof typeof JOB_CATALOG;
export type JobRuntime = (typeof JOB_CATALOG)[JobName]["runtime"];
export type JobStatus = "running" | "succeeded" | "failed" | "dead_lettered";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
}

export interface JobRunInput<TPayload extends JsonRecord = JsonRecord> {
  name: JobName;
  payload: TPayload;
  idempotencyKey: string;
  correlationId?: string;
}

export interface JobAttempt {
  attempt: number;
  delayBeforeNextAttemptMs: number | null;
  error?: string;
}

export interface JobRunRecord<TResult extends JsonValue = JsonValue> {
  runId: string;
  name: JobName;
  payload: JsonRecord;
  idempotencyKey: string;
  correlationId: string;
  status: JobStatus;
  attempts: JobAttempt[];
  result?: TResult;
  error?: string;
  duplicate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeadLetterRecord {
  run: JobRunRecord;
  failedAt: string;
  reason: string;
}

export interface JobHandlerContext<TPayload extends JsonRecord = JsonRecord> {
  name: JobName;
  payload: TPayload;
  idempotencyKey: string;
  correlationId: string;
  attempt: number;
}

export type JobHandler<
  TPayload extends JsonRecord = JsonRecord,
  TResult extends JsonValue = JsonValue,
> = (context: JobHandlerContext<TPayload>) => Promise<TResult> | TResult;

export interface JobDefinition<
  TPayload extends JsonRecord = JsonRecord,
  TResult extends JsonValue = JsonValue,
> {
  name: JobName;
  runtime: JobRuntime;
  ownerPhase: string;
  description: string;
  retryPolicy: RetryPolicy;
  handler: JobHandler<TPayload, TResult>;
}

export interface JobStore {
  getByIdempotencyKey(name: JobName, idempotencyKey: string): JobRunRecord | null;
  createRun(input: JobRunInput, correlationId: string): JobRunRecord;
  markAttempt(runId: string, attempt: JobAttempt, status?: JobStatus): JobRunRecord;
  markSucceeded(runId: string, result: JsonValue): JobRunRecord;
  markDeadLettered(runId: string, reason: string): JobRunRecord;
  listDeadLetters(): DeadLetterRecord[];
}

export class InMemoryJobStore implements JobStore {
  private readonly runs = new Map<string, JobRunRecord>();
  private readonly idempotencyKeys = new Map<string, string>();
  private readonly deadLetters: DeadLetterRecord[] = [];

  getByIdempotencyKey(name: JobName, idempotencyKey: string): JobRunRecord | null {
    const runId = this.idempotencyKeys.get(toIdempotencyIndex(name, idempotencyKey));
    if (runId === undefined) {
      return null;
    }

    return this.runs.get(runId) ?? null;
  }

  createRun(input: JobRunInput, correlationId: string): JobRunRecord {
    const now = new Date().toISOString();
    const run: JobRunRecord = {
      runId: makeRunId(input.name),
      name: input.name,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      correlationId,
      status: "running",
      attempts: [],
      duplicate: false,
      createdAt: now,
      updatedAt: now,
    };

    this.runs.set(run.runId, run);
    this.idempotencyKeys.set(toIdempotencyIndex(input.name, input.idempotencyKey), run.runId);
    return run;
  }

  markAttempt(runId: string, attempt: JobAttempt, status: JobStatus = "running"): JobRunRecord {
    const run = this.requireRun(runId);
    const next = {
      ...run,
      status,
      attempts: [...run.attempts, attempt],
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, next);
    return next;
  }

  markSucceeded(runId: string, result: JsonValue): JobRunRecord {
    const run = this.requireRun(runId);
    const next = {
      ...run,
      status: "succeeded" as const,
      result,
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, next);
    return next;
  }

  markDeadLettered(runId: string, reason: string): JobRunRecord {
    const run = this.requireRun(runId);
    const next = {
      ...run,
      status: "dead_lettered" as const,
      error: reason,
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, next);
    this.deadLetters.push({
      run: next,
      failedAt: next.updatedAt,
      reason,
    });
    return next;
  }

  listDeadLetters(): DeadLetterRecord[] {
    return [...this.deadLetters];
  }

  private requireRun(runId: string): JobRunRecord {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new Error(`Unknown job run: ${runId}`);
    }
    return run;
  }
}

export class JobRegistry {
  private readonly definitions = new Map<JobName, JobDefinition>();

  constructor(private readonly store: JobStore = new InMemoryJobStore()) {}

  register(definition: JobDefinition): this {
    this.definitions.set(definition.name, definition);
    return this;
  }

  get(name: JobName): JobDefinition {
    const definition = this.definitions.get(name);
    if (definition === undefined) {
      throw new Error(`Unknown job: ${name}`);
    }
    return definition;
  }

  list(): JobDefinition[] {
    return [...this.definitions.values()];
  }

  deadLetters(): DeadLetterRecord[] {
    return this.store.listDeadLetters();
  }

  async run(input: JobRunInput): Promise<JobRunRecord> {
    const existing = this.store.getByIdempotencyKey(input.name, input.idempotencyKey);
    if (existing !== null) {
      return { ...existing, duplicate: true };
    }

    const definition = this.get(input.name);
    const correlationId = input.correlationId ?? makeCorrelationId(input.name);
    const run = this.store.createRun(input, correlationId);

    for (
      let attemptNumber = 1;
      attemptNumber <= definition.retryPolicy.maxAttempts;
      attemptNumber += 1
    ) {
      try {
        const result = await definition.handler({
          name: input.name,
          payload: input.payload,
          idempotencyKey: input.idempotencyKey,
          correlationId,
          attempt: attemptNumber,
        });
        this.store.markAttempt(run.runId, {
          attempt: attemptNumber,
          delayBeforeNextAttemptMs: null,
        });
        return this.store.markSucceeded(run.runId, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const finalAttempt = attemptNumber >= definition.retryPolicy.maxAttempts;
        this.store.markAttempt(
          run.runId,
          {
            attempt: attemptNumber,
            delayBeforeNextAttemptMs: finalAttempt
              ? null
              : calculateBackoffMs(definition.retryPolicy, attemptNumber),
            error: message,
          },
          finalAttempt ? "failed" : "running",
        );

        if (finalAttempt) {
          return this.store.markDeadLettered(run.runId, message);
        }
      }
    }

    return this.store.markDeadLettered(run.runId, "retry loop exhausted");
  }
}

export function createInMemoryJobStore(): InMemoryJobStore {
  return new InMemoryJobStore();
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  backoffFactor: 2,
  maxDelayMs: 60_000,
};

export function calculateBackoffMs(policy: RetryPolicy, failedAttempt: number): number {
  const raw = policy.baseDelayMs * policy.backoffFactor ** (failedAttempt - 1);
  return Math.min(raw, policy.maxDelayMs);
}

export function createDefaultJobRegistry(store: JobStore = new InMemoryJobStore()): JobRegistry {
  const registry = new JobRegistry(store);

  for (const [name, metadata] of Object.entries(JOB_CATALOG)) {
    registry.register({
      name: name as JobName,
      runtime: metadata.runtime,
      ownerPhase: metadata.ownerPhase,
      description: metadata.description,
      retryPolicy: DEFAULT_RETRY_POLICY,
      handler: ({ correlationId }) => ({
        ok: true,
        stub: true,
        ownerPhase: metadata.ownerPhase,
        correlationId,
      }),
    });
  }

  return registry;
}

export interface TriggerVerificationInput {
  headers: HeaderReader;
  secret: string | undefined;
}

export interface TriggerVerificationResult {
  ok: boolean;
  status: 401 | 500;
  reason: string;
}

export type HeaderReader =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

export function verifyJobTrigger(
  input: TriggerVerificationInput,
): true | TriggerVerificationResult {
  const secret = input.secret?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 500,
      reason: "missing_job_trigger_secret",
    };
  }

  const bearer = readHeader(input.headers, "authorization");
  if (constantTimeEqual(bearer, `Bearer ${secret}`)) {
    return true;
  }

  const directSecret = readHeader(input.headers, "x-ai-oss-job-secret");
  if (constantTimeEqual(directSecret, secret)) {
    return true;
  }

  return {
    ok: false,
    status: 401,
    reason: "unauthorized_job_trigger",
  };
}

// Constant-time secret comparison to avoid leaking the trigger secret through
// response-timing side channels. Length is intentionally compared first; the
// secret is server-generated so its length is not itself sensitive.
function constantTimeEqual(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) {
    result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return result === 0;
}

export const WAIT_UNTIL_ALLOWED_FOR = [
  "analytics_logging",
  "cache_refresh",
  "non_critical_metrics",
] as const;

export type WaitUntilUse = (typeof WAIT_UNTIL_ALLOWED_FOR)[number];

export function assertWaitUntilUse(use: string): asserts use is WaitUntilUse {
  if (!WAIT_UNTIL_ALLOWED_FOR.includes(use as WaitUntilUse)) {
    throw new Error(
      `waitUntil is only allowed for non-critical after-response work; received ${use}`,
    );
  }
}

function readHeader(headers: HeaderReader, name: string): string | null {
  const maybeHeaders = headers as { get?: unknown };
  if (typeof maybeHeaders.get === "function") {
    return maybeHeaders.get(name) as string | null;
  }

  const recordHeaders = headers as Record<string, string | string[] | undefined>;
  const lowerName = name.toLowerCase();
  const value =
    recordHeaders[name] ??
    recordHeaders[lowerName] ??
    recordHeaders[canonicalHeaderName(lowerName)];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function canonicalHeaderName(lowerName: string): string {
  return lowerName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function toIdempotencyIndex(name: JobName, idempotencyKey: string): string {
  return `${name}:${idempotencyKey}`;
}

function makeRunId(name: JobName): string {
  return `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeCorrelationId(name: JobName): string {
  return `corr-${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
