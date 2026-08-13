import { z } from "zod";

import { commitmentStateSchema, proposalTargetSchema } from "./domain-dtos.js";
import {
  commandMetadataSchema,
  ianaTimeZoneSchema,
  idempotencyKeySchema,
  localDateSchema,
  requestFingerprintSchema,
  revisionDecimalSchema,
  rfc3339InstantSchema,
  sourceContextSchema,
  uuidV7Schema,
} from "./primitives.js";

const withCommandMetadata = <T extends z.ZodRawShape>(shape: T) => commandMetadataSchema.extend(shape);

export const createTaskCommandSchema = withCommandMetadata({
  taskId: uuidV7Schema,
  title: z.string().min(1),
  commitmentState: commitmentStateSchema,
  dueAt: rfc3339InstantSchema.optional(),
  dueOn: localDateSchema.optional(),
});

export const completeTaskCommandSchema = commandMetadataSchema;

export const createTimeBlockCommandSchema = withCommandMetadata({
  timeBlockId: uuidV7Schema,
  taskId: uuidV7Schema,
  startAt: rfc3339InstantSchema,
  endAt: rfc3339InstantSchema,
  timezone: ianaTimeZoneSchema,
  locked: z.boolean(),
}).refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), { message: "endAt must be after startAt" });

export const moveTimeBlockCommandSchema = withCommandMetadata({
  startAt: rfc3339InstantSchema,
  endAt: rfc3339InstantSchema,
  timezone: ianaTimeZoneSchema,
}).refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), { message: "endAt must be after startAt" });

export const createCaptureCommandSchema = withCommandMetadata({
  captureId: uuidV7Schema,
  rawPayload: z.object({ id: uuidV7Schema, kind: z.literal("text"), text: z.string().min(1) }).strict(),
});

export const generateStructuredTriageProposalCommandSchema = commandMetadataSchema;
export const applyProposalCommandSchema = withCommandMetadata({ targets: z.array(proposalTargetSchema).min(1) });

export const commitDailyPlanCommandSchema = withCommandMetadata({
  planSnapshotId: uuidV7Schema,
  date: localDateSchema,
  timezone: ianaTimeZoneSchema,
  capacityMinutes: z.number().int().nonnegative(),
  taskIds: z.array(uuidV7Schema),
  timeBlockIds: z.array(uuidV7Schema),
});

export const createReviewSnapshotCommandSchema = withCommandMetadata({
  reviewSnapshotId: uuidV7Schema,
  date: localDateSchema,
  timezone: ianaTimeZoneSchema,
  baselinePlanSnapshotId: uuidV7Schema,
  finalPlanSnapshotId: uuidV7Schema,
  executionRecordIds: z.array(uuidV7Schema),
});

export const offlineCaptureCommandSchema = z
  .object({
    localId: uuidV7Schema,
    commandType: z.literal("capture.create"),
    payload: createCaptureCommandSchema,
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: requestFingerprintSchema,
    capturedAt: rfc3339InstantSchema,
    retryCount: z.number().int().nonnegative(),
    state: z.enum(["pending", "syncing", "conflict", "done", "failed"]),
  })
  .strict();

export type CreateCaptureCommandDto = z.infer<typeof createCaptureCommandSchema>;
export type OfflineCaptureCommand = z.infer<typeof offlineCaptureCommandSchema>;

export const devSessionRequestSchema = z.object({}).strict();
export const devSessionResponseSchema = z
  .object({
    profile: z.literal("development"),
    authenticated: z.literal(true),
    cookie: z.object({ httpOnly: z.literal(true), secureInProduction: z.literal(true), sameSite: z.literal("lax") }).strict(),
  })
  .strict();

export const idempotencyContractSchema = z
  .object({
    actorScope: z.enum(["user", "system", "ai", "connector"]),
    commandType: z.string().min(1),
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: requestFingerprintSchema,
    result: z.enum(["first_execution", "exact_replay", "idempotency_conflict"]),
  })
  .strict();

export const transportRevisionSchema = revisionDecimalSchema;
export const transportSourceContextSchema = sourceContextSchema;
