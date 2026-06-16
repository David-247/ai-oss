import { NextResponse } from "next/server";
import {
  createDefaultJobRegistry,
  verifyJobTrigger,
  type JobName,
  type JsonRecord,
} from "@ai-oss/jobs";

const registry = createDefaultJobRegistry();

export function listJobs() {
  return registry.list().map((job) => ({
    name: job.name,
    runtime: job.runtime,
    ownerPhase: job.ownerPhase,
    description: job.description,
    retryPolicy: job.retryPolicy,
  }));
}

export async function dispatchJobRequest(
  request: Request,
  source: "cron" | "workflow",
): Promise<NextResponse> {
  const secret = process.env.JOB_TRIGGER_SECRET ?? process.env.CRON_SECRET;
  const verification = verifyJobTrigger({
    headers: request.headers,
    secret,
  });

  if (verification !== true) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/unauthorized-job-trigger",
        title:
          verification.status === 500 ? "Job trigger secret missing" : "Unauthorized job trigger",
        status: verification.status,
        detail: verification.reason,
      },
      { status: verification.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "invalid-json", "Request body must be valid JSON.");
  }

  const parsed = parseJobRequestBody(body);
  if (!parsed.ok) {
    return problem(400, "invalid-job-request", parsed.reason);
  }

  const run = await registry.run({
    name: parsed.name,
    payload: {
      ...parsed.payload,
      trigger_source: source,
    },
    idempotencyKey: parsed.idempotencyKey,
    correlationId: parsed.correlationId,
  });

  return NextResponse.json(
    {
      run,
      deadLetters: registry.deadLetters(),
    },
    {
      status: run.status === "dead_lettered" ? 500 : 202,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function parseJobRequestBody(body: unknown):
  | {
      ok: true;
      name: JobName;
      payload: JsonRecord;
      idempotencyKey: string;
      correlationId?: string;
    }
  | { ok: false; reason: string } {
  if (!isRecord(body)) {
    return { ok: false, reason: "Expected an object body." };
  }

  if (typeof body.name !== "string" || !isJobName(body.name)) {
    return { ok: false, reason: "Unknown or missing job name." };
  }

  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.trim().length === 0) {
    return { ok: false, reason: "Missing idempotencyKey." };
  }

  if (body.payload !== undefined && !isRecord(body.payload)) {
    return { ok: false, reason: "payload must be an object when provided." };
  }

  if (body.correlationId !== undefined && typeof body.correlationId !== "string") {
    return { ok: false, reason: "correlationId must be a string when provided." };
  }

  return {
    ok: true,
    name: body.name,
    payload: body.payload ?? {},
    idempotencyKey: body.idempotencyKey,
    correlationId: body.correlationId,
  };
}

function problem(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json(
    {
      type: `https://www.ai-oss.net/errors/${code}`,
      title: "Invalid job request",
      status,
      detail,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJobName(value: string): value is JobName {
  return listJobs().some((job) => job.name === value);
}
