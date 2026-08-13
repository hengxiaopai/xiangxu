/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import { Revision, UUIDv7, createPlanSnapshot, createTask, createTimeBlock, parseIanaTimeZone, parseRfc3339Instant, type ActorRef, type ReviewSnapshot } from "@xiangxu/domain";
import type { CommitDailyPlan, CompleteTask, CreateLibrary, CreateReviewSnapshot, MoveTimeBlock, TransactionRepositories, UnitOfWork } from "./index.js";
import { ApplicationError, KnowledgeHandlers, PlanReviewHandlers, TaskHandlers, TimeBlockHandlers, decideIdempotency, decideRevision } from "./index.js";

const actor = {
  actorType: "user" as const,
  actorId: UUIDv7.parse("0198f1a0-2234-7abc-8def-0123456789ab"),
};

describe("Application policy contracts", () => {
  it("never permits silent last-write-wins", () => {
    const decision = decideRevision(Revision.parseBigInt(1n), Revision.parseBigInt(2n));
    expect(decision).toEqual({ outcome: "conflict", code: "REVISION_CONFLICT", currentRevision: 2n });
  });

  it("retains an extreme Revision in command decisions", () => {
    const revision = Revision.parseBigInt("9007199254740993");
    expect(decideRevision(revision, revision)).toEqual({ outcome: "matched", revision });
  });

  it("distinguishes first execution, exact replay and key conflicts", () => {
    const identity = {
      actor,
      commandType: "task.create",
      idempotencyKey: "0198f1a0-1234-7abc-8def-0123456789ab",
      requestFingerprint: "sha256:canonical-a",
    };
    expect(decideIdempotency(identity)).toEqual({ outcome: "first-execution" });
    const stored = { ...identity, successfulResult: { taskId: "task-1" } };
    expect(decideIdempotency(identity, stored)).toEqual({
      outcome: "exact-replay",
      storedSuccessfulResult: { taskId: "task-1" },
    });
    expect(decideIdempotency({ ...identity, requestFingerprint: "sha256:canonical-b" }, stored)).toEqual({
      outcome: "conflict",
      code: "IDEMPOTENCY_CONFLICT",
    });
  });
});

describe("Task handler concurrency semantics", () => {
  const taskId = UUIDv7.parse("0198f1a0-3333-7abc-8def-0123456789ab");
  const commandId = UUIDv7.parse("0198f1a0-4444-7abc-8def-0123456789ab");
  const now = parseRfc3339Instant("2026-08-13T00:00:00.000Z");
  const task = createTask({ id: taskId, title: "CAS", ownerId: actor.actorId, commitmentState: "committed", createdAt: now, createdBy: actor });
  const command: CompleteTask = {
    commandId,
    commandType: "task.complete",
    actor,
    idempotency: { key: "complete-test-001", requestFingerprint: `sha256:${"a".repeat(64)}` },
    sourceContext: { route: "/test" },
    baseRevision: Revision.parseBigInt(1n),
    payload: { taskId },
  };

  it("returns a completed exact replay before reading the current Fact", async () => {
    let taskRead = false;
    const repositories = baseRepositories();
    repositories.idempotency.reserve = async () => ({
      outcome: "exact-replay",
      storedResult: { status: 200, body: { revision: "2" }, etagRevision: Revision.parseBigInt(2n) },
    });
    repositories.tasks.getById = async () => { taskRead = true; return task; };
    const result = await new TaskHandlers(unitOfWork(repositories), runtime()).complete(command);
    expect(result).toMatchObject({ status: 200, etagRevision: 2n, replayed: true });
    expect(taskRead).toBe(false);
  });

  it("maps a CAS lost after validation to REVISION_CONFLICT without LWW", async () => {
    const repositories = baseRepositories();
    repositories.tasks.getById = async () => task;
    repositories.tasks.updateCas = async () => ({ outcome: "conflict" });
    await expect(new TaskHandlers(unitOfWork(repositories), runtime()).complete(command)).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
    } satisfies Partial<ApplicationError>);
  });
});

describe("Knowledge handler transaction semantics", () => {
  it("creates one Library with audit, Outbox, idempotency and server actor ownership", async () => {
    const repositories = baseRepositories();
    let insertedOwner = "";
    let changes = 0;
    let events = 0;
    repositories.knowledge.insertLibrary = async (library) => { insertedOwner = library.ownerId; return library; };
    repositories.changes.append = async () => { changes += 1; };
    repositories.outbox.append = async () => { events += 1; return 1n; };
    const command: CreateLibrary = {
      commandId: UUIDv7.parse("0198f1a0-4444-7abc-8def-0123456789ab"),
      commandType: "knowledge.library.create",
      actor,
      idempotency: { key: "knowledge-library-001", requestFingerprint: `sha256:${"f".repeat(64)}` },
      sourceContext: { route: "/api/v1/libraries", surface: "knowledge-overview" },
      payload: { libraryId: UUIDv7.parse("0198f1a0-4333-7abc-8def-0123456789ab"), name: "研究资料" },
    };
    const result = await new KnowledgeHandlers(unitOfWork(repositories), runtime()).createLibrary(command);
    expect(insertedOwner).toBe(actor.actorId);
    expect(result).toMatchObject({ status: 201, replayed: false });
    expect({ changes, events }).toEqual({ changes: 1, events: 1 });
  });
});

describe("TimeBlock handler authority and CAS semantics", () => {
  const timeBlockId = UUIDv7.parse("0198f1a0-6666-7abc-8def-0123456789ab");
  const commandId = UUIDv7.parse("0198f1a0-7777-7abc-8def-0123456789ab");
  const current = createTimeBlock({
    id: timeBlockId,
    ownerId: actor.actorId,
    taskId: UUIDv7.parse("0198f1a0-3333-7abc-8def-0123456789ab"),
    startAt: "2026-08-13T09:00:00.000Z",
    endAt: "2026-08-13T10:00:00.000Z",
    timezone: "Asia/Shanghai",
    locked: false,
    revision: Revision.parseBigInt(1n),
  });

  function moveCommand(actorOverride: ActorRef = actor): MoveTimeBlock {
    return {
      commandId,
      commandType: "timeblock.move",
      actor: actorOverride,
      idempotency: { key: "move-test-001", requestFingerprint: `sha256:${"b".repeat(64)}` },
      sourceContext: { route: "/test" },
      baseRevision: Revision.parseBigInt(1n),
      payload: {
        timeBlockId,
        startAt: parseRfc3339Instant("2026-08-13T10:00:00.000Z"),
        endAt: parseRfc3339Instant("2026-08-13T11:00:00.000Z"),
        timezone: parseIanaTimeZone("Asia/Shanghai"),
      },
    };
  }

  it("returns an exact replay before acquiring the planning lock or reading state", async () => {
    const repositories = baseRepositories();
    let lockAcquired = false;
    let blockRead = false;
    repositories.idempotency.reserve = async () => ({
      outcome: "exact-replay",
      storedResult: { status: 200, body: { revision: "2" }, etagRevision: Revision.parseBigInt(2n) },
    });
    repositories.planningLock.acquireOwner = async () => { lockAcquired = true; };
    repositories.timeBlocks.getById = async () => { blockRead = true; return current; };
    const result = await new TimeBlockHandlers(unitOfWork(repositories), runtime()).move(moveCommand());
    expect(result).toMatchObject({ status: 200, etagRevision: 2n, replayed: true });
    expect(lockAcquired).toBe(false);
    expect(blockRead).toBe(false);
  });

  it("maps a CAS lost after validation to REVISION_CONFLICT", async () => {
    const repositories = baseRepositories();
    repositories.timeBlocks.getById = async () => current;
    await expect(new TimeBlockHandlers(unitOfWork(repositories), runtime()).move(moveCommand())).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
    } satisfies Partial<ApplicationError>);
  });

  it.each(["system", "ai"] as const)("rejects a %s move of a locked block before overlap, CAS, audit, or outbox writes", async (actorType) => {
    const planningActor = { actorType, actorId: actor.actorId };
    const repositories = baseRepositories();
    let overlapRead = false;
    let casWritten = false;
    let auditWritten = false;
    let outboxWritten = false;
    repositories.timeBlocks.getById = async () => ({ ...current, locked: true });
    repositories.timeBlocks.findOverlap = async () => { overlapRead = true; return null; };
    repositories.timeBlocks.updateCas = async () => { casWritten = true; return { outcome: "conflict" }; };
    repositories.changes.append = async () => { auditWritten = true; };
    repositories.outbox.append = async () => { outboxWritten = true; return 1n; };
    await expect(new TimeBlockHandlers(unitOfWork(repositories), runtime()).move(moveCommand(planningActor))).rejects.toMatchObject({
      code: "TIMEBLOCK_LOCKED",
    } satisfies Partial<ApplicationError>);
    expect({ overlapRead, casWritten, auditWritten, outboxWritten }).toEqual({
      overlapRead: false,
      casWritten: false,
      auditWritten: false,
      outboxWritten: false,
    });
  });
});

describe("Daily Plan and Review handlers", () => {
  const taskId = UUIDv7.parse("0198f1a0-6333-7abc-8def-0123456789ab");
  const planId = UUIDv7.parse("0198f1a0-7333-7abc-8def-0123456789ab");
  const reviewId = UUIDv7.parse("0198f1a0-8333-7abc-8def-0123456789ab");
  const commandId = UUIDv7.parse("0198f1a0-9333-7abc-8def-0123456789ab");
  const timezone = parseIanaTimeZone("Asia/Shanghai");
  const task = createTask({
    id: taskId,
    title: "Commit Daily Plan",
    ownerId: actor.actorId,
    commitmentState: "committed",
    createdAt: parseRfc3339Instant("2026-08-13T00:00:00.000Z"),
    createdBy: actor,
  });
  const planCommand: CommitDailyPlan = {
    commandId,
    commandType: "plan.commit-daily",
    actor,
    idempotency: { key: "daily-plan-001", requestFingerprint: `sha256:${"d".repeat(64)}` },
    sourceContext: { route: "/app/today" },
    payload: {
      planSnapshotId: planId,
      date: "2026-08-13",
      timezone,
      capacityMinutes: 90,
      taskIds: [taskId],
      timeBlockIds: [],
    },
  };

  it("commits one immutable baseline with audit, Outbox and idempotency", async () => {
    const repositories = baseRepositories();
    let insertedPlan: ReturnType<typeof createPlanSnapshot> | undefined;
    let changeCount = 0;
    let outboxCount = 0;
    let completed = false;
    repositories.tasks.getById = async () => task;
    repositories.planSnapshots.insert = async (_ownerId, snapshot) => { insertedPlan = snapshot; return snapshot; };
    repositories.changes.append = async () => { changeCount++; };
    repositories.outbox.append = async () => { outboxCount++; return 1n; };
    repositories.idempotency.complete = async () => { completed = true; };
    const result = await new PlanReviewHandlers(unitOfWork(repositories), runtime()).commitPlan(planCommand);
    expect(insertedPlan).toMatchObject({ id: planId, version: 1, capacityMinutes: 90 });
    expect(insertedPlan?.items).toEqual([{ taskId, order: 1, timeBlockIds: [] }]);
    expect(result).toMatchObject({ status: 201, replayed: false });
    expect({ changeCount, outboxCount, completed }).toEqual({ changeCount: 1, outboxCount: 1, completed: true });
  });

  it("returns an exact Plan replay before allocating another version", async () => {
    const repositories = baseRepositories();
    let versionAllocated = false;
    repositories.idempotency.reserve = async () => ({
      outcome: "exact-replay",
      storedResult: { status: 201, body: { affectedRefs: [], projectionHints: [], changeId: planId } },
    });
    repositories.planSnapshots.nextVersionUnderLock = async () => { versionAllocated = true; return 2; };
    const result = await new PlanReviewHandlers(unitOfWork(repositories), runtime()).commitPlan(planCommand);
    expect(result.replayed).toBe(true);
    expect(versionAllocated).toBe(false);
  });

  it("creates a deterministic Review with actual missing and no AI refs", async () => {
    const repositories = baseRepositories();
    const plan = createPlanSnapshot({
      id: planId,
      date: "2026-08-13",
      timezone,
      version: 1,
      capacityMinutes: 90,
      items: [{ taskId, order: 1, timeBlockIds: [] }],
      assumptionsAndEvidence: [],
      committedBy: actor,
      committedAt: parseRfc3339Instant("2026-08-13T00:00:00.000Z"),
    });
    repositories.planSnapshots.getById = async () => ({ ownerId: actor.actorId, snapshot: plan });
    repositories.planSnapshots.getLatest = async () => plan;
    repositories.changes.readChangedRefs = async () => [{ objectType: "task", id: taskId }];
    let inserted: ReviewSnapshot | undefined;
    repositories.reviewSnapshots.insert = async (_ownerId, _version, _createdBy, _createdAt, snapshot) => {
      inserted = snapshot;
      return snapshot;
    };
    const command: CreateReviewSnapshot = {
      commandId,
      commandType: "review.create-snapshot",
      actor,
      idempotency: { key: "daily-review-001", requestFingerprint: `sha256:${"e".repeat(64)}` },
      sourceContext: { route: "/app/review" },
      payload: {
        reviewSnapshotId: reviewId,
        date: "2026-08-13",
        timezone,
        baselinePlanSnapshotId: planId,
        finalPlanSnapshotId: planId,
        executionRecordIds: [],
      },
    };
    await new PlanReviewHandlers(unitOfWork(repositories), runtime()).createReview(command);
    expect(inserted).toMatchObject({
      executionRecordIds: [],
      aiInsightRefs: [],
      derivedMetrics: { plannedCount: 1, actualExecutionCount: 0, actualDurationMinutes: 0 },
    });
  });
});

function runtime() {
  return {
    now: () => parseRfc3339Instant("2026-08-13T00:00:01.000Z"),
    newId: () => UUIDv7.parse("0198f1a0-5555-7abc-8def-0123456789ab"),
  };
}

function unitOfWork(repositories: TransactionRepositories): UnitOfWork {
  return { transaction: async (operation) => operation(repositories) };
}

function baseRepositories(): TransactionRepositories {
  return {
    tasks: {
      insert: async ({ task }) => task,
      getById: async () => null,
      listByOwner: async () => [],
      updateCas: async () => ({ outcome: "conflict" }),
    },
    timeBlocks: {
      insert: async (block) => block,
      getById: async () => null,
      updateCas: async () => ({ outcome: "conflict" }),
      findOverlap: async () => null,
    },
    planningLock: { acquireOwner: async () => undefined, acquireDaily: async () => undefined },
    planSnapshots: {
      nextVersionUnderLock: async () => 1,
      insert: async (_ownerId, snapshot) => snapshot,
      getById: async () => null,
      getLatest: async () => null,
    },
    executionRecords: { getOwnedByIds: async () => [] },
    reviewSnapshots: {
      nextVersionUnderLock: async () => 1,
      insert: async (_ownerId, _version, _createdBy, _createdAt, snapshot) => snapshot,
      getLatest: async () => null,
    },
    captures: {
      insertRawPayload: async (payload) => payload,
      insert: async (capture) => capture,
      getById: async () => null,
      getWithRawPayload: async () => null,
      applyProposalCas: async () => ({ outcome: "conflict" }),
    },
    proposals: {
      insert: async (proposal) => proposal,
      getById: async () => null,
      getByIdForUpdate: async () => null,
      markApplied: async () => false,
    },
    knowledge: {
      insertLibrary: async (library) => library,
      listLibraries: async () => [],
      getOverview: async () => ({
        metrics: { added: 0, unread: 0, reading: 0, settled: 0, longUnread: 0 },
        libraries: [],
      }),
    },
    changes: {
      append: async () => undefined,
      readByCorrelationId: async () => [],
      readChangedRefs: async () => [],
    },
    outbox: {
      append: async () => 1n,
      appendCaptureTriageRequested: async () => 2n,
      readByCorrelationId: async () => [],
    },
    idempotency: {
      reserve: async () => ({ outcome: "first-execution" }),
      complete: async () => undefined,
    },
  };
}
