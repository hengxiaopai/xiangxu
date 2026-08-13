/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  Revision,
  UUIDv7,
  completeTask,
  createExecutionRecord,
  createLibrary,
  createPlanSnapshot,
  createReviewSnapshot,
  createTask,
  createTimeBlock,
  isProposalStale,
  moveTimeBlock,
  parseRfc3339Instant,
  parseIanaTimeZone,
  validateProposal,
  type ActorRef,
  type Proposal,
} from "./index.js";

const ids = {
  task: UUIDv7.parse("0198f1a0-1234-7abc-8def-0123456789ab"),
  owner: UUIDv7.parse("0198f1a0-2234-7abc-8def-0123456789ab"),
  block: UUIDv7.parse("0198f1a0-3234-7abc-8def-0123456789ab"),
  capture: UUIDv7.parse("0198f1a0-4234-7abc-8def-0123456789ab"),
  proposal: UUIDv7.parse("0198f1a0-5234-7abc-8def-0123456789ab"),
  execution: UUIDv7.parse("0198f1a0-6234-7abc-8def-0123456789ab"),
  plan: UUIDv7.parse("0198f1a0-7234-7abc-8def-0123456789ab"),
  review: UUIDv7.parse("0198f1a0-8234-7abc-8def-0123456789ab"),
};
const user: ActorRef = { actorType: "user", actorId: ids.owner };
const system: ActorRef = { actorType: "system", actorId: ids.owner };
const instant = parseRfc3339Instant("2026-08-12T09:00:00+08:00");

describe("UUIDv7 and Revision", () => {
  it("accepts only canonical lowercase RFC 9562 UUIDv7", () => {
    expect(UUIDv7.toString(ids.task)).toBe("0198f1a0-1234-7abc-8def-0123456789ab");
    expect(() => UUIDv7.parse("0198f1a0-1234-4abc-8def-0123456789ab")).toThrow();
    expect(() => UUIDv7.parse("0198F1A0-1234-7ABC-8DEF-0123456789AB")).toThrow();
    expect(() => UUIDv7.parse("0198f1a0-1234-7abc-7def-0123456789ab")).toThrow();
    expect(() => parseRfc3339Instant("2026-02-30T09:00:00+08:00")).toThrow();
  });

  it("round-trips revisions above Number.MAX_SAFE_INTEGER without number coercion", () => {
    const value = Revision.parseBigInt("9007199254740993");
    expect(Revision.toDecimalString(value)).toBe("9007199254740993");
    expect(Revision.toDecimalString(Revision.increment(value))).toBe("9007199254740994");
    expect(() => Revision.parseBigInt("01")).toThrow();
  });
});

describe("Task invariants", () => {
  it("creates and completes a Task with a monotonic revision", () => {
    const task = createTask({
      id: ids.task,
      title: "  Freeze contracts  ",
      ownerId: ids.owner,
      commitmentState: "committed",
      dueAt: parseRfc3339Instant("2026-08-12T18:00:00+08:00"),
      createdAt: instant,
      createdBy: user,
    });
    expect(task.status).toBe("open");
    expect(task.title).toBe("Freeze contracts");
    const completed = completeTask(task, user, parseRfc3339Instant("2026-08-12T10:00:00+08:00"));
    expect(completed.status).toBe("completed");
    expect(completed.revision).toBe(2n);
    expect(() => completeTask(completed, user, instant)).toThrow(/cannot transition/);
  });
});

describe("Knowledge Library invariants", () => {
  it("creates one owner-scoped support entity without duplicating a core object", () => {
    const library = createLibrary({
      id: ids.proposal,
      ownerId: ids.owner,
      name: "  研究资料  ",
      description: "  长期阅读与沉淀  ",
      createdAt: instant,
      createdBy: user,
    });
    expect(library).toMatchObject({ name: "研究资料", description: "长期阅读与沉淀", ownerId: ids.owner });
    expect(Object.isFrozen(library)).toBe(true);
    expect(() => createLibrary({ ...library, name: " ", createdBy: user })).toThrow("name is required");
    expect(() => createLibrary({ ...library, createdBy: system })).toThrow("owning user Actor");
  });
});

describe("due, schedule and actual remain separate", () => {
  const task = createTask({
    id: ids.task,
    title: "Contract work",
    ownerId: ids.owner,
    commitmentState: "committed",
    dueAt: parseRfc3339Instant("2026-08-12T18:00:00+08:00"),
    createdAt: instant,
    createdBy: user,
  });
  const block = createTimeBlock({
    id: ids.block,
    ownerId: ids.owner,
    taskId: ids.task,
    startAt: "2026-08-12T11:00:00+08:00",
    endAt: "2026-08-12T12:00:00+08:00",
    timezone: "Asia/Shanghai",
    locked: true,
    revision: Revision.parseBigInt(1n),
  });

  it("moving a TimeBlock never mutates Task due", () => {
    const moved = moveTimeBlock(block, user, "2026-08-12T13:00:00+08:00", "2026-08-12T14:00:00+08:00", "Asia/Shanghai");
    expect(moved.startAt).not.toBe(block.startAt);
    expect(task.dueAt).toBe("2026-08-12T18:00:00+08:00");
  });

  it("rejects a locked system replan but permits explicit user adjustment", () => {
    expect(() => moveTimeBlock(block, system, "2026-08-12T13:00:00+08:00", "2026-08-12T14:00:00+08:00", "Asia/Shanghai")).toThrow("TIMEBLOCK_LOCKED");
    expect(moveTimeBlock(block, user, "2026-08-12T13:00:00+08:00", "2026-08-12T14:00:00+08:00", "Asia/Shanghai").revision).toBe(2n);
  });

  it("rejects invalid intervals and timezone values", () => {
    expect(() => createTimeBlock({ ...block, startAt: block.endAt, endAt: block.startAt, timezone: "Asia/Shanghai" })).toThrow();
    expect(() => createTimeBlock({ ...block, startAt: block.startAt, endAt: block.endAt, timezone: "Mars/Olympus" })).toThrow();
  });

  it("records immutable actual execution without rewriting the plan", () => {
    const actual = createExecutionRecord({
      id: ids.execution,
      targetObjectId: ids.task,
      startedAt: parseRfc3339Instant("2026-08-12T11:10:00+08:00"),
      endedAt: parseRfc3339Instant("2026-08-12T11:40:00+08:00"),
      durationMinutes: 30,
      outcome: "partial",
      source: "manual",
      timeBlockId: ids.block,
    });
    expect(Object.isFrozen(actual)).toBe(true);
    expect(block.startAt).toBe("2026-08-12T11:00:00+08:00");
    expect(task.status).toBe("open");
  });
});

describe("Proposal semantics", () => {
  const targetRef = { objectType: "capture_item", id: ids.capture } as const;
  const proposal: Proposal = {
    id: ids.proposal,
    proposalType: "classify",
    targetRefs: [targetRef],
    baseRevisions: [{ targetRef, baseRevision: Revision.parseBigInt(1n) }],
    patch: { kind: "capture.classify", captureId: ids.capture, candidateType: "task" },
    rationale: "The capture is actionable.",
    evidenceRefs: [targetRef],
    impactSummary: "Classifies one capture; no Fact mutation before Apply.",
    riskLevel: "low",
    status: "ready",
    createdBy: { actorType: "ai", actorId: ids.owner },
  };

  it("uses an allowlisted typed patch and detects stale targets", () => {
    expect(validateProposal(proposal)).toBe(proposal);
    expect(isProposalStale(proposal, new Map([[`capture_item:${ids.capture}`, Revision.parseBigInt(2n)]]))).toBe(true);
    expect(isProposalStale(proposal, new Map([[`capture_item:${ids.capture}`, Revision.parseBigInt(1n)]]))).toBe(false);
  });

  it("rejects an invalid proposal target and mismatched patch taxonomy", () => {
    expect(() => validateProposal({ ...proposal, targetRefs: [], baseRevisions: [] })).toThrow();
    expect(() => validateProposal({ ...proposal, proposalType: "create" })).toThrow();
    expect(() => validateProposal({ ...proposal, genericPatch: { arbitrary: true } })).toThrow(/unknown field/u);
    expect(() => validateProposal({ ...proposal, patch: { ...proposal.patch, arbitrary: true } })).toThrow(/unknown field/u);
  });
});

describe("Plan and Review snapshot semantics", () => {
  it("freezes append-only historical membership without copying a Task", () => {
    const snapshot = createPlanSnapshot({
      id: ids.plan,
      date: "2026-08-13",
      timezone: parseIanaTimeZone("Asia/Shanghai"),
      version: 1,
      capacityMinutes: 120,
      items: [{ taskId: ids.task, order: 1, timeBlockIds: [ids.block] }],
      assumptionsAndEvidence: [],
      committedBy: user,
      committedAt: instant,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.items)).toBe(true);
    expect(snapshot.items[0]).toEqual({ taskId: ids.task, order: 1, timeBlockIds: [ids.block] });
    expect(snapshot.items[0]).not.toHaveProperty("title");
  });

  it("rejects duplicate Plan membership and keeps Review values immutable", () => {
    expect(() => createPlanSnapshot({
      id: ids.plan,
      date: "2026-08-13",
      timezone: parseIanaTimeZone("Asia/Shanghai"),
      version: 1,
      capacityMinutes: 0,
      items: [
        { taskId: ids.task, order: 1, timeBlockIds: [] },
        { taskId: ids.task, order: 2, timeBlockIds: [] },
      ],
      assumptionsAndEvidence: [],
      committedBy: user,
      committedAt: instant,
    })).toThrow("unique");
    const review = createReviewSnapshot({
      id: ids.review,
      date: "2026-08-13",
      timezone: parseIanaTimeZone("Asia/Shanghai"),
      baselinePlanSnapshotId: ids.plan,
      finalPlanSnapshotId: ids.plan,
      executionRecordIds: [],
      whatChanged: [{ objectType: "task", id: ids.task }],
      derivedMetrics: { plannedCount: 1, actualExecutionCount: 0, actualDurationMinutes: 0 },
      aiInsightRefs: [],
    });
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(review.derivedMetrics)).toBe(true);
  });
});
