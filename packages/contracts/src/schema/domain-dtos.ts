import { z } from "zod";

import {
  actorRefSchema,
  affectedRefsAndProjectionHintsSchema,
  ianaTimeZoneSchema,
  localDateSchema,
  objectRefSchema,
  revisionDecimalSchema,
  rfc3339InstantSchema,
  uuidV7Schema,
} from "./primitives.js";

export const taskStatusSchema = z.enum(["open", "in_progress", "waiting", "completed", "cancelled"]);
export const commitmentStateSchema = z.enum(["committed", "someday"]);

export const taskDtoSchema = z
  .object({
    id: uuidV7Schema,
    title: z.string().min(1),
    ownerId: uuidV7Schema,
    status: taskStatusSchema,
    commitmentState: commitmentStateSchema,
    dueAt: rfc3339InstantSchema.optional(),
    dueOn: localDateSchema.optional(),
    revision: revisionDecimalSchema,
    createdAt: rfc3339InstantSchema,
    updatedAt: rfc3339InstantSchema,
    createdBy: actorRefSchema,
    updatedBy: actorRefSchema,
    completedAt: rfc3339InstantSchema.optional(),
  })
  .strict();

export const timeBlockDtoSchema = z
  .object({
    id: uuidV7Schema,
    ownerId: uuidV7Schema,
    taskId: uuidV7Schema,
    startAt: rfc3339InstantSchema,
    endAt: rfc3339InstantSchema,
    timezone: ianaTimeZoneSchema,
    locked: z.boolean(),
    revision: revisionDecimalSchema,
  })
  .strict()
  .refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), { message: "endAt must be after startAt" });

export const rawPayloadRefSchema = z.object({ id: uuidV7Schema, kind: z.literal("text") }).strict();

export const captureItemDtoSchema = z
  .object({
    id: uuidV7Schema,
    ownerId: uuidV7Schema,
    rawPayloadRef: rawPayloadRefSchema,
    parseStatus: z.enum(["pending", "parsed", "failed", "partial"]),
    triageStatus: z.enum(["untriaged", "proposal_ready", "needs_review", "accepted", "archived"]),
    revision: revisionDecimalSchema,
    proposalId: uuidV7Schema.optional(),
    materializedObjectIds: z.array(uuidV7Schema),
  })
  .strict();

const classifyCapturePatchSchema = z
  .object({ kind: z.literal("capture.classify"), captureId: uuidV7Schema, candidateType: z.literal("task") })
  .strict();
const createTaskPatchSchema = z
  .object({
    kind: z.literal("task.create"),
    captureId: uuidV7Schema,
    task: z
      .object({
        title: z.string().min(1),
        commitmentState: commitmentStateSchema,
        dueAt: rfc3339InstantSchema.optional(),
        dueOn: localDateSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const proposalPatchSchema = z.discriminatedUnion("kind", [classifyCapturePatchSchema, createTaskPatchSchema]);
export const proposalTargetSchema = z.object({ targetRef: objectRefSchema, baseRevision: revisionDecimalSchema }).strict();

export const proposalDtoSchema = z
  .object({
    id: uuidV7Schema,
    proposalType: z.enum(["classify", "reprioritize", "reschedule", "relate", "create", "update", "memory", "review_suggestion"]),
    targetRefs: z.array(objectRefSchema).min(1),
    baseRevisions: z.array(proposalTargetSchema).min(1),
    patch: proposalPatchSchema,
    rationale: z.string().min(1),
    evidenceRefs: z.array(objectRefSchema),
    impactSummary: z.string().min(1),
    riskLevel: z.enum(["low", "medium", "high"]),
    status: z.enum(["draft", "ready", "applied", "rejected", "expired", "cancelled"]),
    createdBy: actorRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.patch.kind === "capture.classify" && value.proposalType !== "classify") {
      context.addIssue({ code: "custom", message: "Classification patch requires classify proposalType" });
    }
    if (value.patch.kind === "task.create" && value.proposalType !== "create") {
      context.addIssue({ code: "custom", message: "Task patch requires create proposalType" });
    }
  });

export const mutationResultSchema = affectedRefsAndProjectionHintsSchema.extend({
  changeId: uuidV7Schema,
  revision: revisionDecimalSchema.optional(),
});

export const libraryDtoSchema = z
  .object({
    id: uuidV7Schema,
    ownerId: uuidV7Schema,
    name: z.string().trim().min(1),
    description: z.string(),
    settings: z.record(z.string(), z.unknown()),
    createdAt: rfc3339InstantSchema,
    createdBy: actorRefSchema,
    archivedAt: rfc3339InstantSchema.optional(),
  })
  .strict();

export const knowledgeOverviewMetricsSchema = z
  .object({
    added: z.number().int().nonnegative(),
    unread: z.number().int().nonnegative(),
    reading: z.number().int().nonnegative(),
    settled: z.number().int().nonnegative(),
    longUnread: z.number().int().nonnegative(),
  })
  .strict();

export const knowledgeOverviewDtoSchema = z
  .object({
    metrics: knowledgeOverviewMetricsSchema,
    libraries: z.array(libraryDtoSchema),
  })
  .strict();

export const changeRecordDtoSchema = z
  .object({
    id: uuidV7Schema,
    entityRef: objectRefSchema,
    baseRevision: revisionDecimalSchema,
    newRevision: revisionDecimalSchema,
    actor: actorRefSchema,
    command: z.enum(["create", "update", "status_change", "apply_proposal", "archive", "delete"]),
    changedFieldFamilies: z.array(z.enum(["identity", "status", "commitment", "due", "schedule", "actual", "triage"])),
    proposalId: uuidV7Schema.optional(),
    sourceContext: z.object({ route: z.string().optional(), surface: z.string().optional(), clientId: z.string().optional() }).strict(),
    correlationId: uuidV7Schema,
    createdAt: rfc3339InstantSchema,
    undoOf: uuidV7Schema.optional(),
  })
  .strict();

export type TaskDto = z.infer<typeof taskDtoSchema>;
export type TimeBlockDto = z.infer<typeof timeBlockDtoSchema>;
export type CaptureItemDto = z.infer<typeof captureItemDtoSchema>;
export type ProposalDto = z.infer<typeof proposalDtoSchema>;
export type LibraryDto = z.infer<typeof libraryDtoSchema>;
export type KnowledgeOverviewDto = z.infer<typeof knowledgeOverviewDtoSchema>;
