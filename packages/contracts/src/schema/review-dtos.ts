import { z } from "zod";

import { actorRefSchema, ianaTimeZoneSchema, localDateSchema, objectRefSchema, rfc3339InstantSchema, uuidV7Schema } from "./primitives.js";

export const planSnapshotItemDtoSchema = z
  .object({ taskId: uuidV7Schema, order: z.number().int().positive(), timeBlockIds: z.array(uuidV7Schema) })
  .strict();

export const planSnapshotDtoSchema = z
  .object({
    id: uuidV7Schema,
    date: localDateSchema,
    timezone: ianaTimeZoneSchema,
    version: z.number().int().positive(),
    capacityMinutes: z.number().int().nonnegative(),
    items: z.array(planSnapshotItemDtoSchema),
    assumptionsAndEvidence: z.array(objectRefSchema),
    committedBy: actorRefSchema,
    committedAt: rfc3339InstantSchema,
  })
  .strict();

export const executionRecordDtoSchema = z
  .object({
    id: uuidV7Schema,
    targetObjectId: uuidV7Schema,
    startedAt: rfc3339InstantSchema,
    endedAt: rfc3339InstantSchema,
    durationMinutes: z.number().int().positive(),
    outcome: z.enum(["completed", "partial", "stopped", "interrupted"]),
    source: z.enum(["focus_mode", "manual", "import"]),
    planSnapshotId: uuidV7Schema.optional(),
    timeBlockId: uuidV7Schema.optional(),
  })
  .strict()
  .refine((value) => Date.parse(value.endedAt) > Date.parse(value.startedAt), { message: "endedAt must be after startedAt" });

export const reviewSnapshotDtoSchema = z
  .object({
    id: uuidV7Schema,
    date: localDateSchema,
    timezone: ianaTimeZoneSchema,
    baselinePlanSnapshotId: uuidV7Schema,
    finalPlanSnapshotId: uuidV7Schema,
    executionRecordIds: z.array(uuidV7Schema),
    whatChanged: z.array(objectRefSchema),
    derivedMetrics: z.record(z.string(), z.number()),
    aiInsightRefs: z.array(objectRefSchema),
    tomorrowProposalId: uuidV7Schema.optional(),
    userReflectionNoteId: uuidV7Schema.optional(),
  })
  .strict();

export type PlanSnapshotDto = z.infer<typeof planSnapshotDtoSchema>;
export type PlanSnapshotItemDto = z.infer<typeof planSnapshotItemDtoSchema>;
export type ExecutionRecordDto = z.infer<typeof executionRecordDtoSchema>;
export type ReviewSnapshotDto = z.infer<typeof reviewSnapshotDtoSchema>;
