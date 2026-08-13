import { z } from "zod";

import { revisionDecimalSchema } from "./primitives.js";

export const problemCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "PRECONDITION_REQUIRED",
  "PRECONDITION_FAILED",
  "REVISION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "TIMEBLOCK_LOCKED",
  "TIMEBLOCK_CONFLICT",
  "PROPOSAL_STALE",
  "RATE_LIMITED",
  "AI_UNAVAILABLE",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
  "DEGRADED",
]);

const conflictSchema = z
  .object({
    currentRevision: revisionDecimalSchema,
  })
  .strict();

export const problemDetailsSchema = z
  .object({
    type: z.string().url(),
    title: z.string().min(1),
    status: z.number().int().min(400).max(599),
    detail: z.string().min(1).optional(),
    instance: z.string().min(1).optional(),
    code: problemCodeSchema,
    correlationId: z.string().min(1),
    conflict: conflictSchema.optional(),
    errors: z
      .array(z.object({ path: z.string(), message: z.string().min(1) }).strict())
      .optional(),
    retryable: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedStatus: Record<z.infer<typeof problemCodeSchema>, number> = {
      VALIDATION_ERROR: 400,
      AUTH_REQUIRED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      PRECONDITION_REQUIRED: 428,
      PRECONDITION_FAILED: 412,
      REVISION_CONFLICT: 409,
      IDEMPOTENCY_CONFLICT: 409,
      TIMEBLOCK_LOCKED: 409,
      TIMEBLOCK_CONFLICT: 409,
      PROPOSAL_STALE: 409,
      RATE_LIMITED: 429,
      AI_UNAVAILABLE: 503,
      DEPENDENCY_UNAVAILABLE: 503,
      INTERNAL_ERROR: 500,
      DEGRADED: 503,
    };
    if (value.status !== expectedStatus[value.code]) {
      context.addIssue({ code: "custom", path: ["status"], message: `Expected HTTP ${expectedStatus[value.code]} for ${value.code}` });
    }
  });

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
