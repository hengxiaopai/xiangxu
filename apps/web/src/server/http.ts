import {
  ApplicationError,
  captureToTransport,
  knowledgeOverviewToTransport,
  libraryToTransport,
  parseRuntimeId,
  planSnapshotToTransport,
  proposalToTransport,
  revisionToDecimal,
  reviewSnapshotToTransport,
  taskToTransport,
  type CommandExecutionResult,
} from "@xiangxu/application";
import {
  canonicalizeValidatedRequest,
  captureItemDtoSchema,
  formatRevisionEtag,
  idempotencyKeySchema,
  knowledgeOverviewDtoSchema,
  libraryDtoSchema,
  planSnapshotDtoSchema,
  problemDetailsSchema,
  proposalDtoSchema,
  reviewSnapshotDtoSchema,
  taskDtoSchema,
} from "@xiangxu/contracts";
import { NextResponse } from "next/server";
import { v7 as uuidv7 } from "uuid";

import { devSessionCookie, devSessionHandlers, hashCanonicalRequest } from "./composition/runtime";

export function requestFingerprint(value: unknown): string {
  return hashCanonicalRequest(canonicalizeValidatedRequest(value));
}

export function parseIdempotencyKey(request: Request): string {
  return idempotencyKeySchema.parse(request.headers.get("Idempotency-Key") ?? "");
}

export function taskJson(task: Parameters<typeof taskToTransport>[0]): NextResponse {
  const body = taskDtoSchema.parse(taskToTransport(task));
  return NextResponse.json(body, { headers: { ETag: formatRevisionEtag(body.revision) } });
}

export function taskListJson(tasks: readonly Parameters<typeof taskToTransport>[0][]): NextResponse {
  return NextResponse.json(tasks.map((task) => taskDtoSchema.parse(taskToTransport(task))));
}

export function planSnapshotJson(snapshot: Parameters<typeof planSnapshotToTransport>[0]): NextResponse {
  return NextResponse.json(planSnapshotDtoSchema.parse(planSnapshotToTransport(snapshot)));
}

export function reviewSnapshotJson(snapshot: Parameters<typeof reviewSnapshotToTransport>[0]): NextResponse {
  return NextResponse.json(reviewSnapshotDtoSchema.parse(reviewSnapshotToTransport(snapshot)));
}

export function captureJson(capture: Parameters<typeof captureToTransport>[0]): NextResponse {
  const body = captureItemDtoSchema.parse(captureToTransport(capture));
  return NextResponse.json(body, { headers: { ETag: formatRevisionEtag(body.revision) } });
}

export function proposalJson(proposal: Parameters<typeof proposalToTransport>[0]): NextResponse {
  return NextResponse.json(proposalDtoSchema.parse(proposalToTransport(proposal)));
}

export function libraryListJson(libraries: readonly Parameters<typeof libraryToTransport>[0][]): NextResponse {
  return NextResponse.json(libraries.map((library) => libraryDtoSchema.parse(libraryToTransport(library))));
}

export function knowledgeOverviewJson(overview: Parameters<typeof knowledgeOverviewToTransport>[0]): NextResponse {
  return NextResponse.json(knowledgeOverviewDtoSchema.parse(knowledgeOverviewToTransport(overview)));
}

export function mutationJson(result: CommandExecutionResult): NextResponse {
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.etagRevision !== undefined) {
    response.headers.set("ETag", formatRevisionEtag(revisionToDecimal(result.etagRevision)));
  }
  return response;
}

export async function resolveRequestActor(request: Request) {
  const token = cookieValue(request.headers.get("cookie"), devSessionCookie.name);
  if (token === undefined) throw new ApplicationError("AUTH_REQUIRED", "A valid session is required");
  return devSessionHandlers.resolve(token);
}

export function cookieValue(header: string | null, name: string): string | undefined {
  if (header === null) return undefined;
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function uuidPath(value: string) {
  return parseRuntimeId(value);
}

export class HttpProblemError extends Error {
  constructor(
    readonly status: 400 | 404 | 428,
    readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "PRECONDITION_REQUIRED",
    message: string,
  ) {
    super(message);
  }
}

export function problem(error: unknown, instance: string): NextResponse {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let title = "Internal Server Error";
  let detail: string | undefined;
  let currentRevision: string | undefined;
  let errors: readonly { path: string; message: string }[] | undefined;

  if (error instanceof ApplicationError) {
    const mapped = {
      AUTH_REQUIRED: [401, "AUTH_REQUIRED", "Authentication Required"],
      VALIDATION_ERROR: [400, "VALIDATION_ERROR", "Validation Error"],
      NOT_FOUND: [404, "NOT_FOUND", "Not Found"],
      PRECONDITION_FAILED: [412, "PRECONDITION_FAILED", "Precondition Failed"],
      REVISION_CONFLICT: [409, "REVISION_CONFLICT", "Revision Conflict"],
      IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT", "Idempotency Conflict"],
      IDEMPOTENCY_IN_PROGRESS: [409, "IDEMPOTENCY_CONFLICT", "Idempotency In Progress"],
      TASK_ALREADY_COMPLETE: [409, "REVISION_CONFLICT", "Task State Conflict"],
      TIMEBLOCK_CONFLICT: [409, "TIMEBLOCK_CONFLICT", "TimeBlock Conflict"],
      TIMEBLOCK_LOCKED: [409, "TIMEBLOCK_LOCKED", "TimeBlock Locked"],
      PROPOSAL_STALE: [409, "PROPOSAL_STALE", "Proposal Stale"],
      AI_UNAVAILABLE: [503, "AI_UNAVAILABLE", "AI Unavailable"],
    } as const;
    [status, code, title] = mapped[error.code];
    detail = error.message;
    currentRevision = error.currentRevision === undefined ? undefined : revisionToDecimal(error.currentRevision);
  } else if (error instanceof HttpProblemError) {
    status = error.status;
    code = error.code;
    title = error.code === "PRECONDITION_REQUIRED" ? "Precondition Required" : error.code === "NOT_FOUND" ? "Not Found" : "Validation Error";
    detail = error.message;
  } else if (isZodError(error)) {
    status = 400;
    code = "VALIDATION_ERROR";
    title = "Validation Error";
    errors = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  } else if (error instanceof Error && (error.message.includes("UUIDv7") || error.message.includes("revision ETag"))) {
    status = 400;
    code = "VALIDATION_ERROR";
    title = "Validation Error";
    detail = error.message;
  }

  const correlationId = parseRuntimeId(uuidv7());
  const body = problemDetailsSchema.parse({
    type: `https://xiangxu.local/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title,
    status,
    code,
    correlationId,
    instance,
    ...(detail === undefined ? {} : { detail }),
    ...(currentRevision === undefined ? {} : { conflict: { currentRevision } }),
    ...(errors === undefined ? {} : { errors }),
  });
  return NextResponse.json(body, { status, headers: { "Content-Type": "application/problem+json" } });
}

interface ZodLikeError {
  readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
}

function isZodError(error: unknown): error is ZodLikeError {
  return typeof error === "object" && error !== null && "issues" in error && Array.isArray((error as { issues: unknown }).issues);
}
