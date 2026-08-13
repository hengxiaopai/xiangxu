import {
  Revision,
  UUIDv7,
  acceptCaptureProposal,
  completeTask as transitionTaskToComplete,
  createCaptureItem,
  createPlanSnapshot,
  createReviewSnapshot,
  createTask as createDomainTask,
  createTimeBlock as createDomainTimeBlock,
  moveTimeBlock as moveDomainTimeBlock,
  markProposalApplied,
  parseIanaTimeZone,
  validateProposal,
  type ActorRef,
  type CaptureItem,
  type ChangeRecord,
  type DurableEvent,
  type IanaTimeZone,
  type ObjectRef,
  type PlanSnapshot,
  type Proposal,
  type Revision as RevisionValue,
  type ReviewSnapshot,
  type Rfc3339Instant,
  type Task,
  type TimeBlock,
  type UUIDv7 as UUIDv7Value,
} from "@xiangxu/domain";

import type {
  ApplyProposal,
  CommitDailyPlan,
  CompleteTask,
  CreateCapture,
  CreateTask,
  CreateTimeBlock,
  CreateReviewSnapshot,
  GenerateStructuredTriageProposal,
  MoveTimeBlock,
  SourceContext,
} from "./commands.js";
import { ProposalGeneratorUnavailable } from "./proposal-generator.js";
import type {
  DeviceSessionRecord,
  DeviceSessionRepository,
  DevUserRepository,
  IdempotencyKeyIdentity,
  StructuredProposalGenerator,
  StoredCommandResult,
  TransactionRepositories,
  UnitOfWork,
} from "./ports.js";

export class ApplicationError extends Error {
  constructor(
    readonly code:
      | "AUTH_REQUIRED"
      | "VALIDATION_ERROR"
      | "NOT_FOUND"
      | "PRECONDITION_FAILED"
      | "REVISION_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "IDEMPOTENCY_IN_PROGRESS"
      | "TASK_ALREADY_COMPLETE"
      | "TIMEBLOCK_CONFLICT"
      | "TIMEBLOCK_LOCKED"
      | "PROPOSAL_STALE"
      | "AI_UNAVAILABLE",
    message: string,
    readonly currentRevision?: RevisionValue,
  ) {
    super(message);
  }
}

export interface CommandExecutionResult {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly etagRevision?: RevisionValue;
  readonly replayed: boolean;
}

export interface RuntimeValues {
  now(): Rfc3339Instant;
  newId(): UUIDv7Value;
}

export function parseRuntimeId(value: string): UUIDv7Value {
  return UUIDv7.parse(value);
}

export function parseRuntimeInstant(value: string): Rfc3339Instant {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Instant must be valid RFC3339 text");
  return value as Rfc3339Instant;
}

export function parseRuntimeTimezone(value: string): IanaTimeZone {
  return parseIanaTimeZone(value);
}

export function revisionFromDecimal(value: string): RevisionValue {
  return Revision.parseBigInt(value);
}

export function revisionToDecimal(value: RevisionValue): string {
  return Revision.toDecimalString(value);
}

export function taskToTransport(task: Task): Readonly<Record<string, unknown>> {
  return { ...task, revision: Revision.toDecimalString(task.revision) };
}

export function planSnapshotToTransport(snapshot: PlanSnapshot): Readonly<Record<string, unknown>> {
  return { ...snapshot };
}

export function reviewSnapshotToTransport(snapshot: ReviewSnapshot): Readonly<Record<string, unknown>> {
  return { ...snapshot };
}

export function captureToTransport(capture: CaptureItem): Readonly<Record<string, unknown>> {
  return { ...capture, revision: Revision.toDecimalString(capture.revision) };
}

export function proposalToTransport(proposal: Proposal): Readonly<Record<string, unknown>> {
  return {
    ...proposal,
    baseRevisions: proposal.baseRevisions.map((target) => ({
      targetRef: target.targetRef,
      baseRevision: Revision.toDecimalString(target.baseRevision),
    })),
  };
}

type ImplementedCommand =
  | CreateTask
  | CompleteTask
  | CreateTimeBlock
  | MoveTimeBlock
  | CreateCapture
  | GenerateStructuredTriageProposal
  | ApplyProposal
  | CommitDailyPlan
  | CreateReviewSnapshot;

function identity(command: ImplementedCommand): IdempotencyKeyIdentity {
  return {
    actor: command.actor,
    commandType: command.commandType,
    idempotencyKey: command.idempotency.key,
    requestFingerprint: command.idempotency.requestFingerprint,
  };
}

function replay(result: StoredCommandResult): CommandExecutionResult {
  return { ...result, replayed: true };
}

function mutationBody(task: Task, changeId: UUIDv7) {
  return {
    affectedRefs: [{ objectType: "task", id: task.id }],
    projectionHints: ["today", "tasks"],
    changeId,
    revision: Revision.toDecimalString(task.revision),
  } as const;
}

function changeRecord(
  id: UUIDv7Value,
  task: Task,
  baseRevision: RevisionValue,
  actor: ActorRef,
  command: ChangeRecord["command"],
  changedFieldFamilies: ChangeRecord["changedFieldFamilies"],
  sourceContext: SourceContext,
  correlationId: UUIDv7Value,
  createdAt: Rfc3339Instant,
  proposalId?: UUIDv7Value,
): ChangeRecord {
  return {
    id,
    entityRef: { objectType: "task", id: task.id },
    baseRevision,
    newRevision: task.revision,
    actor,
    command,
    changedFieldFamilies,
    ...(proposalId === undefined ? {} : { proposalId }),
    sourceContext,
    correlationId,
    createdAt,
  };
}

async function createTaskFact(
  repositories: TransactionRepositories,
  runtime: RuntimeValues,
  command: CreateTask,
  proposalId?: UUIDv7Value,
) {
  const now = runtime.now();
  const task = createDomainTask({
    id: command.payload.taskId,
    title: command.payload.title,
    ownerId: command.actor.actorId,
    commitmentState: command.payload.commitmentState,
    ...(command.payload.dueAt === undefined ? {} : { dueAt: command.payload.dueAt }),
    ...(command.payload.dueOn === undefined ? {} : { dueOn: command.payload.dueOn }),
    createdAt: now,
    createdBy: command.actor,
  });
  const inserted = await repositories.tasks.insert({ task });
  const changeId = runtime.newId();
  await repositories.changes.append(changeRecord(
    changeId,
    inserted,
    Revision.parseBigInt(1n),
    command.actor,
    "create",
    ["identity", "status", "commitment"],
    command.sourceContext,
    command.commandId,
    now,
    proposalId,
  ));
  await repositories.outbox.append(outboxEvent(runtime.newId(), inserted, command.commandId, now));
  return { task: inserted, changeId } as const;
}

function outboxEvent(
  eventId: UUIDv7Value,
  task: Task,
  commandId: UUIDv7Value,
  occurredAt: Rfc3339Instant,
): DurableEvent {
  return {
    eventId,
    topic: "object.changed",
    affectedRefs: [{ objectType: "task", id: task.id }],
    projectionHints: ["today", "tasks"],
    revision: task.revision,
    commandId,
    correlationId: commandId,
    occurredAt,
  };
}

async function reserveOrReplay(
  repository: Parameters<Parameters<UnitOfWork["transaction"]>[0]>[0]["idempotency"],
  command: ImplementedCommand,
): Promise<CommandExecutionResult | null> {
  const reservation = await repository.reserve(identity(command));
  if (reservation.outcome === "exact-replay") return replay(reservation.storedResult);
  if (reservation.outcome === "conflict") throw new ApplicationError("IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different request");
  if (reservation.outcome === "in-progress") throw new ApplicationError("IDEMPOTENCY_IN_PROGRESS", "Idempotent request is still in progress");
  return null;
}

function timeBlockMutationBody(block: TimeBlock, changeId: UUIDv7Value) {
  return {
    affectedRefs: [{ objectType: "time_block", id: block.id }],
    projectionHints: ["today", "calendar"],
    changeId,
    revision: Revision.toDecimalString(block.revision),
  } as const;
}

function timeBlockChangeRecord(
  id: UUIDv7Value,
  block: TimeBlock,
  baseRevision: RevisionValue,
  actor: ActorRef,
  command: ChangeRecord["command"],
  sourceContext: SourceContext,
  correlationId: UUIDv7Value,
  createdAt: Rfc3339Instant,
): ChangeRecord {
  return {
    id,
    entityRef: { objectType: "time_block", id: block.id },
    baseRevision,
    newRevision: block.revision,
    actor,
    command,
    changedFieldFamilies: ["schedule"],
    sourceContext,
    correlationId,
    createdAt,
  };
}

function timeBlockOutboxEvent(
  eventId: UUIDv7Value,
  block: TimeBlock,
  commandId: UUIDv7Value,
  occurredAt: Rfc3339Instant,
): DurableEvent {
  return {
    eventId,
    topic: "object.changed",
    affectedRefs: [{ objectType: "time_block", id: block.id }],
    projectionHints: ["today", "calendar"],
    revision: block.revision,
    commandId,
    correlationId: commandId,
    occurredAt,
  };
}

export class TaskHandlers {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly runtime: RuntimeValues) {}

  async create(command: CreateTask): Promise<CommandExecutionResult> {
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      const created = await createTaskFact(repositories, this.runtime, command);
      const result = { status: 201, body: mutationBody(created.task, created.changeId), etagRevision: created.task.revision } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }

  async get(actor: ActorRef, taskId: UUIDv7): Promise<Task> {
    return this.unitOfWork.transaction(async ({ tasks }) => {
      const task = await tasks.getById(taskId);
      if (task === null || task.ownerId !== actor.actorId) throw new ApplicationError("NOT_FOUND", "Task not found");
      return task;
    });
  }

  async list(actor: ActorRef): Promise<readonly Task[]> {
    return this.unitOfWork.transaction(({ tasks }) => tasks.listByOwner(actor.actorId));
  }

  async complete(command: CompleteTask): Promise<CommandExecutionResult> {
    if (command.baseRevision === undefined) throw new Error("CompleteTask requires baseRevision");
    const baseRevision = command.baseRevision;
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      const current = await repositories.tasks.getById(command.payload.taskId);
      if (current === null || current.ownerId !== command.actor.actorId) throw new ApplicationError("NOT_FOUND", "Task not found");
      if (!Revision.equals(current.revision, baseRevision)) {
        throw new ApplicationError("PRECONDITION_FAILED", "Task revision does not match If-Match", current.revision);
      }
      let transitioned: Task;
      try {
        transitioned = transitionTaskToComplete(current, command.actor, this.runtime.now());
      } catch {
        throw new ApplicationError("TASK_ALREADY_COMPLETE", "Task cannot be completed from its current state");
      }
      const updated = await repositories.tasks.updateCas(current.id, baseRevision, {
        status: transitioned.status,
        ...(transitioned.completedAt === undefined ? {} : { completedAt: transitioned.completedAt }),
        updatedAt: transitioned.updatedAt,
        updatedBy: command.actor,
      });
      if (updated.outcome === "conflict") throw new ApplicationError("REVISION_CONFLICT", "Task changed before CAS update");
      const changeId = this.runtime.newId();
      await repositories.changes.append(changeRecord(changeId, updated.value, baseRevision, command.actor, "status_change", ["status"], command.sourceContext, command.commandId, transitioned.updatedAt));
      await repositories.outbox.append(outboxEvent(this.runtime.newId(), updated.value, command.commandId, transitioned.updatedAt));
      const result = { status: 200, body: mutationBody(updated.value, changeId), etagRevision: updated.newRevision } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }
}

function dailyMutationBody(
  objectType: "plan_snapshot" | "review_snapshot",
  id: UUIDv7Value,
  revision: RevisionValue,
  changeId: UUIDv7Value,
) {
  return {
    affectedRefs: [{ objectType, id }],
    projectionHints: objectType === "plan_snapshot" ? ["today", "review"] : ["review"],
    changeId,
    revision: Revision.toDecimalString(revision),
  } as const;
}

function dailyChangeRecord(
  id: UUIDv7Value,
  entityRef: ObjectRef,
  revision: RevisionValue,
  actor: ActorRef,
  changedFieldFamilies: ChangeRecord["changedFieldFamilies"],
  sourceContext: SourceContext,
  correlationId: UUIDv7Value,
  createdAt: Rfc3339Instant,
): ChangeRecord {
  return {
    id,
    entityRef,
    baseRevision: revision,
    newRevision: revision,
    actor,
    command: "create",
    changedFieldFamilies,
    sourceContext,
    correlationId,
    createdAt,
  };
}

function dailyOutboxEvent(
  eventId: UUIDv7Value,
  entityRef: ObjectRef,
  revision: RevisionValue,
  commandId: UUIDv7Value,
  projectionHints: DurableEvent["projectionHints"],
  occurredAt: Rfc3339Instant,
): DurableEvent {
  return {
    eventId,
    topic: "object.changed",
    affectedRefs: [entityRef],
    projectionHints,
    revision,
    commandId,
    correlationId: commandId,
    occurredAt,
  };
}

function localDateAt(instant: Rfc3339Instant, timezone: IanaTimeZone): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (value.year === undefined || value.month === undefined || value.day === undefined) {
    throw new Error("Local date formatting failed");
  }
  return `${value.year}-${value.month}-${value.day}`;
}

export class PlanReviewHandlers {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly runtime: RuntimeValues) {}

  async commitPlan(command: CommitDailyPlan): Promise<CommandExecutionResult> {
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      await repositories.planningLock.acquireDaily(command.actor.actorId, command.payload.date);

      if (command.payload.taskIds.length > 3) {
        throw new ApplicationError("VALIDATION_ERROR", "Daily Plan supports at most three ranked Tasks");
      }
      if (new Set(command.payload.taskIds).size !== command.payload.taskIds.length ||
          new Set(command.payload.timeBlockIds).size !== command.payload.timeBlockIds.length) {
        throw new ApplicationError("VALIDATION_ERROR", "Daily Plan membership must be unique");
      }

      const tasks = [];
      for (const taskId of command.payload.taskIds) {
        const task = await repositories.tasks.getById(taskId);
        if (task === null || task.ownerId !== command.actor.actorId) {
          throw new ApplicationError("NOT_FOUND", "Daily Plan Task not found");
        }
        tasks.push(task);
      }
      const taskIdSet = new Set(tasks.map((task) => task.id));
      const timeBlocks: TimeBlock[] = [];
      for (const timeBlockId of command.payload.timeBlockIds) {
        const block = await repositories.timeBlocks.getById(timeBlockId);
        if (block === null || block.ownerId !== command.actor.actorId || !taskIdSet.has(block.taskId)) {
          throw new ApplicationError("NOT_FOUND", "Daily Plan TimeBlock not found for an included Task");
        }
        if (localDateAt(block.startAt, command.payload.timezone) !== command.payload.date) {
          throw new ApplicationError("VALIDATION_ERROR", "Daily Plan TimeBlock must start on the requested local date");
        }
        timeBlocks.push(block);
      }

      const version = await repositories.planSnapshots.nextVersionUnderLock(command.actor.actorId, command.payload.date);
      const committedAt = this.runtime.now();
      const snapshot = createPlanSnapshot({
        id: command.payload.planSnapshotId,
        date: command.payload.date,
        timezone: command.payload.timezone,
        version,
        capacityMinutes: command.payload.capacityMinutes,
        items: tasks.map((task, index) => ({
          taskId: task.id,
          order: index + 1,
          timeBlockIds: timeBlocks.filter((block) => block.taskId === task.id).map((block) => block.id),
        })),
        assumptionsAndEvidence: [],
        committedBy: command.actor,
        committedAt,
      });
      const inserted = await repositories.planSnapshots.insert(command.actor.actorId, snapshot);
      const revision = Revision.parseBigInt(BigInt(inserted.version));
      const changeId = this.runtime.newId();
      const entityRef = { objectType: "plan_snapshot", id: inserted.id } as const;
      await repositories.changes.append(dailyChangeRecord(
        changeId, entityRef, revision, command.actor, ["schedule"], command.sourceContext,
        command.commandId, committedAt,
      ));
      await repositories.outbox.append(dailyOutboxEvent(
        this.runtime.newId(), entityRef, revision, command.commandId, ["today", "review"], committedAt,
      ));
      const result = { status: 201, body: dailyMutationBody("plan_snapshot", inserted.id, revision, changeId) } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }

  async getToday(actor: ActorRef, date: string, timezone: IanaTimeZone): Promise<PlanSnapshot> {
    return this.unitOfWork.transaction(async ({ planSnapshots }) => {
      const snapshot = await planSnapshots.getLatest(actor.actorId, date, timezone);
      if (snapshot === null) throw new ApplicationError("NOT_FOUND", "Daily Plan not found");
      return snapshot;
    });
  }

  async createReview(command: CreateReviewSnapshot): Promise<CommandExecutionResult> {
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      await repositories.planningLock.acquireDaily(command.actor.actorId, command.payload.date);

      const baseline = await repositories.planSnapshots.getById(command.payload.baselinePlanSnapshotId);
      const final = await repositories.planSnapshots.getById(command.payload.finalPlanSnapshotId);
      if (baseline === null || final === null || baseline.ownerId !== command.actor.actorId ||
          final.ownerId !== command.actor.actorId || baseline.snapshot.date !== command.payload.date ||
          final.snapshot.date !== command.payload.date || baseline.snapshot.timezone !== command.payload.timezone ||
          final.snapshot.timezone !== command.payload.timezone) {
        throw new ApplicationError("NOT_FOUND", "Review PlanSnapshot not found");
      }
      if (baseline.snapshot.version !== 1) {
        throw new ApplicationError("VALIDATION_ERROR", "Review baseline must be PlanSnapshot version 1");
      }
      const latest = await repositories.planSnapshots.getLatest(
        command.actor.actorId, command.payload.date, command.payload.timezone,
      );
      if (latest === null || latest.id !== final.snapshot.id) {
        throw new ApplicationError("VALIDATION_ERROR", "Review final plan must be the latest PlanSnapshot version");
      }

      if (new Set(command.payload.executionRecordIds).size !== command.payload.executionRecordIds.length) {
        throw new ApplicationError("VALIDATION_ERROR", "Review ExecutionRecord membership must be unique");
      }
      const executionRecords = await repositories.executionRecords.getOwnedByIds(
        command.actor.actorId, command.payload.executionRecordIds,
      );
      if (executionRecords.length !== command.payload.executionRecordIds.length ||
          executionRecords.some((record) => localDateAt(record.startedAt, command.payload.timezone) !== command.payload.date)) {
        throw new ApplicationError("NOT_FOUND", "Review ExecutionRecord not found on the requested local date");
      }

      const createdAt = this.runtime.now();
      const whatChanged = await repositories.changes.readChangedRefs(
        command.actor.actorId, baseline.snapshot.committedAt, createdAt,
      );
      const review = createReviewSnapshot({
        id: command.payload.reviewSnapshotId,
        date: command.payload.date,
        timezone: command.payload.timezone,
        baselinePlanSnapshotId: baseline.snapshot.id,
        finalPlanSnapshotId: final.snapshot.id,
        executionRecordIds: executionRecords.map((record) => record.id),
        whatChanged,
        derivedMetrics: {
          plannedCount: final.snapshot.items.length,
          actualExecutionCount: executionRecords.length,
          actualDurationMinutes: executionRecords.reduce((total, record) => total + record.durationMinutes, 0),
        },
        aiInsightRefs: [],
      });
      const version = await repositories.reviewSnapshots.nextVersionUnderLock(command.actor.actorId, command.payload.date);
      const inserted = await repositories.reviewSnapshots.insert(
        command.actor.actorId, version, command.actor, createdAt, review,
      );
      const revision = Revision.parseBigInt(BigInt(version));
      const changeId = this.runtime.newId();
      const entityRef = { objectType: "review_snapshot", id: inserted.id } as const;
      await repositories.changes.append(dailyChangeRecord(
        changeId, entityRef, revision, command.actor, ["actual"], command.sourceContext,
        command.commandId, createdAt,
      ));
      await repositories.outbox.append(dailyOutboxEvent(
        this.runtime.newId(), entityRef, revision, command.commandId, ["review"], createdAt,
      ));
      const result = { status: 201, body: dailyMutationBody("review_snapshot", inserted.id, revision, changeId) } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }

  async getReview(actor: ActorRef, date: string, timezone: IanaTimeZone): Promise<ReviewSnapshot> {
    return this.unitOfWork.transaction(async ({ reviewSnapshots }) => {
      const snapshot = await reviewSnapshots.getLatest(actor.actorId, date, timezone);
      if (snapshot === null) throw new ApplicationError("NOT_FOUND", "Daily Review not found");
      return snapshot;
    });
  }
}

function captureMutationBody(capture: CaptureItem, changeId: UUIDv7Value) {
  return {
    affectedRefs: [{ objectType: "capture_item", id: capture.id }],
    projectionHints: ["captures"],
    changeId,
    revision: Revision.toDecimalString(capture.revision),
  } as const;
}

function captureChangeRecord(
  id: UUIDv7Value,
  capture: CaptureItem,
  baseRevision: RevisionValue,
  actor: ActorRef,
  command: ChangeRecord["command"],
  sourceContext: SourceContext,
  correlationId: UUIDv7Value,
  createdAt: Rfc3339Instant,
  proposalId?: UUIDv7Value,
): ChangeRecord {
  return {
    id,
    entityRef: { objectType: "capture_item", id: capture.id },
    baseRevision,
    newRevision: capture.revision,
    actor,
    command,
    changedFieldFamilies: ["triage"],
    ...(proposalId === undefined ? {} : { proposalId }),
    sourceContext,
    correlationId,
    createdAt,
  };
}

function captureOutboxEvent(
  eventId: UUIDv7Value,
  capture: CaptureItem,
  commandId: UUIDv7Value,
  occurredAt: Rfc3339Instant,
): DurableEvent {
  return {
    eventId,
    topic: "object.changed",
    affectedRefs: [{ objectType: "capture_item", id: capture.id }],
    projectionHints: ["captures"],
    revision: capture.revision,
    commandId,
    correlationId: commandId,
    occurredAt,
  };
}

function proposalChangeRecord(
  id: UUIDv7Value,
  proposalId: UUIDv7Value,
  actor: ActorRef,
  command: ChangeRecord["command"],
  sourceContext: SourceContext,
  correlationId: UUIDv7Value,
  createdAt: Rfc3339Instant,
): ChangeRecord {
  return {
    id,
    entityRef: { objectType: "proposal", id: proposalId },
    baseRevision: Revision.parseBigInt(1n),
    newRevision: Revision.parseBigInt(1n),
    actor,
    command,
    changedFieldFamilies: [command === "create" ? "triage" : "status"],
    ...(command === "apply_proposal" ? { proposalId } : {}),
    sourceContext,
    correlationId,
    createdAt,
  };
}

function proposalReadyOutboxEvent(
  eventId: UUIDv7Value,
  proposalId: UUIDv7Value,
  captureId: UUIDv7Value,
  commandId: UUIDv7Value,
  occurredAt: Rfc3339Instant,
): DurableEvent {
  return {
    eventId,
    topic: "proposal.ready",
    affectedRefs: [
      { objectType: "proposal", id: proposalId },
      { objectType: "capture_item", id: captureId },
    ],
    projectionHints: ["proposals", "captures"],
    commandId,
    correlationId: commandId,
    occurredAt,
  };
}

export interface CreateCaptureContent {
  readonly text: string;
  readonly contentHash: string;
}

export class CaptureHandlers {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly runtime: RuntimeValues) {}

  async create(command: CreateCapture, content: CreateCaptureContent): Promise<CommandExecutionResult> {
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      await repositories.captures.insertRawPayload({
        id: command.payload.rawPayloadId,
        ownerId: command.actor.actorId,
        kind: command.payload.rawPayloadKind,
        textContent: content.text,
        contentHash: content.contentHash,
      });
      const capture = createCaptureItem({
        id: command.payload.captureId,
        ownerId: command.actor.actorId,
        rawPayloadRef: { id: command.payload.rawPayloadId, kind: command.payload.rawPayloadKind },
      });
      const inserted = await repositories.captures.insert(capture);
      const now = this.runtime.now();
      const changeId = this.runtime.newId();
      await repositories.changes.append(captureChangeRecord(
        changeId,
        inserted,
        Revision.parseBigInt(1n),
        command.actor,
        "create",
        command.sourceContext,
        command.commandId,
        now,
      ));
      await repositories.outbox.append(captureOutboxEvent(this.runtime.newId(), inserted, command.commandId, now));
      await repositories.outbox.appendCaptureTriageRequested({
        eventId: this.runtime.newId(),
        captureId: inserted.id,
        commandId: command.commandId,
        correlationId: command.commandId,
        occurredAt: now,
      });
      const result = {
        status: 201,
        body: captureMutationBody(inserted, changeId),
        etagRevision: inserted.revision,
      } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }

  async get(actor: ActorRef, captureId: UUIDv7Value): Promise<CaptureItem> {
    return this.unitOfWork.transaction(async ({ captures }) => {
      const capture = await captures.getById(captureId);
      if (capture === null || capture.ownerId !== actor.actorId) {
        throw new ApplicationError("NOT_FOUND", "Capture not found");
      }
      return capture;
    });
  }
}

function targetIdentity(target: { readonly ref: { readonly objectType: string; readonly id: string }; readonly baseRevision: RevisionValue }) {
  return `${target.ref.objectType}:${target.ref.id}:${target.baseRevision.toString()}`;
}

export class ProposalHandlers {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly runtime: RuntimeValues,
    private readonly generator: StructuredProposalGenerator,
  ) {}

  async get(actor: ActorRef, proposalId: UUIDv7Value): Promise<Proposal> {
    return this.unitOfWork.transaction(async ({ proposals, captures }) => {
      const proposal = await proposals.getById(proposalId);
      if (proposal === null || proposal.patch.kind !== "task.create") {
        throw new ApplicationError("NOT_FOUND", "Proposal not found");
      }
      const capture = await captures.getById(proposal.patch.captureId);
      if (capture === null || capture.ownerId !== actor.actorId) {
        throw new ApplicationError("NOT_FOUND", "Proposal not found");
      }
      return proposal;
    });
  }

  async generate(command: GenerateStructuredTriageProposal): Promise<CommandExecutionResult> {
    if (command.actor.actorType !== "system") throw new Error("Proposal generation requires a system Actor");
    return this.unitOfWork.transaction((repositories) => this.generateInTransaction(repositories, command));
  }

  async generateFromDispatch(input: ProposalGenerationDispatch): Promise<CommandExecutionResult> {
    return this.unitOfWork.transaction(async (repositories) => {
      const capture = await repositories.captures.getById(input.captureId);
      if (capture === null) throw new ApplicationError("NOT_FOUND", "Capture not found");
      const command: GenerateStructuredTriageProposal = {
        commandId: input.triggerEventId,
        commandType: "proposal.generate-structured-triage",
        actor: { actorType: "system", actorId: capture.ownerId },
        idempotency: { key: input.triggerEventId, requestFingerprint: input.requestFingerprint },
        sourceContext: { surface: "outbox-dispatch", clientId: input.triggerEventId },
        payload: { captureId: input.captureId },
      };
      return this.generateInTransaction(repositories, command);
    });
  }

  private async generateInTransaction(
    repositories: TransactionRepositories,
    command: GenerateStructuredTriageProposal,
  ): Promise<CommandExecutionResult> {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      const loaded = await repositories.captures.getWithRawPayload(command.payload.captureId);
      if (loaded === null || loaded.capture.ownerId !== command.actor.actorId) {
        throw new ApplicationError("NOT_FOUND", "Capture not found");
      }
      let generated: unknown;
      try {
        generated = await this.generator.generate({
          proposalId: this.runtime.newId(),
          capture: loaded.capture,
          rawText: loaded.rawPayload.textContent,
          createdBy: command.actor,
        });
      } catch (error) {
        if (error instanceof ProposalGeneratorUnavailable) {
          throw new ApplicationError("AI_UNAVAILABLE", error.message);
        }
        throw error;
      }
      const proposal = validateProposal(generated);
      const base = proposal.baseRevisions[0];
      if (
        proposal.proposalType !== "create" || proposal.patch.kind !== "task.create" ||
        proposal.status !== "ready" || proposal.createdBy.actorType !== "system" ||
        proposal.createdBy.actorId !== command.actor.actorId || proposal.patch.captureId !== loaded.capture.id ||
        proposal.targetRefs.length !== 1 || proposal.baseRevisions.length !== 1 ||
        base?.targetRef.objectType !== "capture_item" || base.targetRef.id !== loaded.capture.id ||
        !Revision.equals(base.baseRevision, loaded.capture.revision)
      ) {
        throw new Error("Generator result violates the frozen Stage 5 Proposal profile");
      }
      const inserted = await repositories.proposals.insert(proposal);
      const now = this.runtime.now();
      const changeId = this.runtime.newId();
      await repositories.changes.append(proposalChangeRecord(
        changeId,
        inserted.id,
        command.actor,
        "create",
        command.sourceContext,
        command.commandId,
        now,
      ));
      await repositories.outbox.append(proposalReadyOutboxEvent(
        this.runtime.newId(), inserted.id, loaded.capture.id, command.commandId, now,
      ));
      const result = {
        status: 202,
        body: {
          affectedRefs: [{ objectType: "proposal", id: inserted.id }],
          projectionHints: ["proposals", "captures"],
          changeId,
        },
      } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
  }

  async apply(command: ApplyProposal): Promise<CommandExecutionResult> {
    if (command.actor.actorType !== "user") throw new ApplicationError("AUTH_REQUIRED", "Explicit user confirmation is required");
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      const proposal = await repositories.proposals.getByIdForUpdate(command.payload.proposalId);
      if (proposal === null || proposal.patch.kind !== "task.create") {
        throw new ApplicationError("NOT_FOUND", "Proposal not found");
      }
      const capture = await repositories.captures.getById(proposal.patch.captureId);
      if (capture === null || capture.ownerId !== command.actor.actorId) {
        throw new ApplicationError("NOT_FOUND", "Proposal not found");
      }
      if (proposal.status !== "ready") {
        throw new ApplicationError("REVISION_CONFLICT", "Proposal is not ready");
      }
      markProposalApplied(proposal);
      const expectedTargets = proposal.baseRevisions
        .map(({ targetRef, baseRevision }) => targetIdentity({ ref: targetRef, baseRevision }))
        .sort();
      const confirmedTargets = command.payload.targets.map(targetIdentity).sort();
      if (expectedTargets.length !== confirmedTargets.length || expectedTargets.some((value, index) => value !== confirmedTargets[index])) {
        throw new ApplicationError("PROPOSAL_STALE", "Apply targets do not match the Proposal");
      }
      const target = proposal.baseRevisions[0];
      if (
        target === undefined || target.targetRef.objectType !== "capture_item" ||
        target.targetRef.id !== capture.id || !Revision.equals(target.baseRevision, capture.revision)
      ) {
        throw new ApplicationError("PROPOSAL_STALE", "Proposal target revision is stale");
      }
      const taskId = this.runtime.newId();
      const taskCommand: CreateTask = {
        commandId: command.commandId,
        commandType: "task.create",
        actor: command.actor,
        idempotency: command.idempotency,
        sourceContext: command.sourceContext,
        payload: {
          taskId,
          title: proposal.patch.task.title,
          commitmentState: proposal.patch.task.commitmentState,
          ...(proposal.patch.task.dueAt === undefined ? {} : { dueAt: parseRuntimeInstant(proposal.patch.task.dueAt) }),
          ...(proposal.patch.task.dueOn === undefined ? {} : { dueOn: proposal.patch.task.dueOn }),
        },
      };
      const expectedCapture = acceptCaptureProposal(capture, proposal.id, taskId);
      const taskMutation = await createTaskFact(repositories, this.runtime, taskCommand, proposal.id);
      const updatedCapture = await repositories.captures.applyProposalCas(
        capture.id,
        capture.revision,
        proposal.id,
        taskMutation.task.id,
      );
      if (updatedCapture.outcome === "conflict") {
        throw new ApplicationError("REVISION_CONFLICT", "Capture changed before Apply CAS");
      }
      if (!Revision.equals(updatedCapture.value.revision, expectedCapture.revision)) {
        throw new Error("Capture Apply CAS returned an unexpected revision");
      }
      const now = this.runtime.now();
      const captureChangeId = this.runtime.newId();
      await repositories.changes.append(captureChangeRecord(
        captureChangeId,
        updatedCapture.value,
        capture.revision,
        command.actor,
        "apply_proposal",
        command.sourceContext,
        command.commandId,
        now,
        proposal.id,
      ));
      await repositories.outbox.append(captureOutboxEvent(
        this.runtime.newId(), updatedCapture.value, command.commandId, now,
      ));
      await repositories.changes.append(proposalChangeRecord(
        this.runtime.newId(), proposal.id, command.actor, "apply_proposal",
        command.sourceContext, command.commandId, now,
      ));
      if (!(await repositories.proposals.markApplied(proposal.id))) {
        throw new ApplicationError("REVISION_CONFLICT", "Proposal lifecycle changed before Apply");
      }
      const result = {
        status: 200,
        body: {
          affectedRefs: [
            { objectType: "task", id: taskMutation.task.id },
            { objectType: "capture_item", id: updatedCapture.value.id },
            { objectType: "proposal", id: proposal.id },
          ],
          projectionHints: ["today", "tasks", "captures", "proposals"],
          changeId: captureChangeId,
        },
      } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }
}

export interface ProposalGenerationDispatch {
  readonly triggerEventId: UUIDv7Value;
  readonly captureId: UUIDv7Value;
  readonly requestFingerprint: string;
}

export class TimeBlockHandlers {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly runtime: RuntimeValues) {}

  async create(command: CreateTimeBlock): Promise<CommandExecutionResult> {
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      await repositories.planningLock.acquireOwner(command.actor.actorId);
      const task = await repositories.tasks.getById(command.payload.taskId);
      if (task === null || task.ownerId !== command.actor.actorId) {
        throw new ApplicationError("NOT_FOUND", "Task not found");
      }
      const overlap = await repositories.timeBlocks.findOverlap(
        command.actor.actorId,
        command.payload.startAt,
        command.payload.endAt,
      );
      if (overlap !== null) throw new ApplicationError("TIMEBLOCK_CONFLICT", "TimeBlock overlaps an existing block");
      const created = createDomainTimeBlock({
        id: command.payload.timeBlockId,
        ownerId: command.actor.actorId,
        taskId: command.payload.taskId,
        startAt: command.payload.startAt,
        endAt: command.payload.endAt,
        timezone: command.payload.timezone,
        locked: command.payload.locked,
        revision: Revision.parseBigInt(1n),
      });
      const inserted = await repositories.timeBlocks.insert(created);
      const now = this.runtime.now();
      const changeId = this.runtime.newId();
      await repositories.changes.append(timeBlockChangeRecord(
        changeId,
        inserted,
        Revision.parseBigInt(1n),
        command.actor,
        "create",
        command.sourceContext,
        command.commandId,
        now,
      ));
      await repositories.outbox.append(timeBlockOutboxEvent(this.runtime.newId(), inserted, command.commandId, now));
      const result = { status: 201, body: timeBlockMutationBody(inserted, changeId), etagRevision: inserted.revision } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }

  async move(command: MoveTimeBlock): Promise<CommandExecutionResult> {
    if (command.baseRevision === undefined) throw new Error("MoveTimeBlock requires baseRevision");
    const baseRevision = command.baseRevision;
    return this.unitOfWork.transaction(async (repositories) => {
      const replayed = await reserveOrReplay(repositories.idempotency, command);
      if (replayed !== null) return replayed;
      await repositories.planningLock.acquireOwner(command.actor.actorId);
      const current = await repositories.timeBlocks.getById(command.payload.timeBlockId);
      if (current === null || current.ownerId !== command.actor.actorId) {
        throw new ApplicationError("NOT_FOUND", "TimeBlock not found");
      }
      if (!Revision.equals(current.revision, baseRevision)) {
        throw new ApplicationError("PRECONDITION_FAILED", "TimeBlock revision does not match If-Match", current.revision);
      }
      let moved: TimeBlock;
      try {
        moved = moveDomainTimeBlock(
          current,
          command.actor,
          command.payload.startAt,
          command.payload.endAt,
          command.payload.timezone,
        );
      } catch (error) {
        if (error instanceof Error && error.message === "TIMEBLOCK_LOCKED") {
          throw new ApplicationError("TIMEBLOCK_LOCKED", "Locked TimeBlock cannot be moved by this actor");
        }
        throw error;
      }
      const overlap = await repositories.timeBlocks.findOverlap(
        current.ownerId,
        moved.startAt,
        moved.endAt,
        current.id,
      );
      if (overlap !== null) throw new ApplicationError("TIMEBLOCK_CONFLICT", "TimeBlock overlaps an existing block");
      const updated = await repositories.timeBlocks.updateCas(current.id, baseRevision, {
        startAt: moved.startAt,
        endAt: moved.endAt,
        timezone: moved.timezone,
      });
      if (updated.outcome === "conflict") {
        throw new ApplicationError("REVISION_CONFLICT", "TimeBlock changed before CAS update");
      }
      const now = this.runtime.now();
      const changeId = this.runtime.newId();
      await repositories.changes.append(timeBlockChangeRecord(
        changeId,
        updated.value,
        baseRevision,
        command.actor,
        "update",
        command.sourceContext,
        command.commandId,
        now,
      ));
      await repositories.outbox.append(timeBlockOutboxEvent(this.runtime.newId(), updated.value, command.commandId, now));
      const result = { status: 200, body: timeBlockMutationBody(updated.value, changeId), etagRevision: updated.newRevision } as const;
      await repositories.idempotency.complete(identity(command), result);
      return { ...result, replayed: false };
    });
  }
}

export interface SessionCrypto {
  createOpaqueToken(): string;
  hashToken(token: string): string;
}

export class DevSessionHandlers {
  constructor(
    private readonly users: DevUserRepository,
    private readonly sessions: DeviceSessionRepository,
    private readonly crypto: SessionCrypto,
    private readonly runtime: RuntimeValues,
  ) {}

  async establish(subject: string, expiresAt: Rfc3339Instant) {
    const userId = await this.users.ensureDevUser(subject);
    const token = this.crypto.createOpaqueToken();
    const session = await this.sessions.create({ userId, tokenHash: this.crypto.hashToken(token), expiresAt });
    return { token, session };
  }

  async resolve(token: string): Promise<{ readonly actor: ActorRef; readonly session: DeviceSessionRecord }> {
    const session = await this.sessions.findActiveByTokenHash(this.crypto.hashToken(token), this.runtime.now());
    if (session === null) throw new ApplicationError("AUTH_REQUIRED", "A valid session is required");
    return { actor: { actorType: "user", actorId: session.userId }, session };
  }

  async end(token: string): Promise<boolean> {
    const resolved = await this.resolve(token);
    return this.sessions.revoke(resolved.session.id, this.runtime.now());
  }
}
