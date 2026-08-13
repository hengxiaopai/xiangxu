import { createHash } from "node:crypto";

import {
  ApplicationError,
  PlanReviewHandlers,
  TaskHandlers,
  type CommitDailyPlan,
  type CompleteTask,
  type CreateReviewSnapshot,
  type CreateTask,
  type RuntimeValues,
} from "@xiangxu/application";
import {
  Revision,
  UUIDv7,
  parseIanaTimeZone,
  parseRfc3339Instant,
  type ActorRef,
} from "@xiangxu/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PgCaptureTriageDispatchStore } from "../async/outbox-dispatcher.js";
import { PgIdentityRepository } from "./identity-repository.js";
import { createPostgresPool } from "./pool.js";
import { PgSseEventStream } from "./sse-event-stream.js";
import { PgUnitOfWork } from "./unit-of-work.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");

const pool = createPostgresPool(databaseUrl);
const unitOfWork = new PgUnitOfWork(pool);
const identities = new PgIdentityRepository(pool);
const tasks = new TaskHandlers(unitOfWork, runtime());
const dailyLoop = new PlanReviewHandlers(unitOfWork, runtime());
const timezone = parseIanaTimeZone("Asia/Shanghai");
const localDate = "2026-08-13";
let idCounter = 0x9000;
let instantCounter = 0;

function nextId() {
  const middle = (idCounter++).toString(16).padStart(4, "0");
  return UUIDv7.parse(`0198f1b0-${middle}-7abc-8def-0123456789ab`);
}

function runtime(): RuntimeValues {
  return {
    now: () => parseRfc3339Instant(new Date(Date.parse("2026-08-13T00:00:00.000Z") + instantCounter++).toISOString()),
    newId: nextId,
  };
}

const fingerprint = (seed: string) => `sha256:${createHash("sha256").update(seed).digest("hex")}`;

async function newActor(label: string): Promise<ActorRef> {
  return { actorType: "user", actorId: await identities.ensureDevUser(`stage7-${label}-${nextId()}`) };
}

async function createTask(owner: ActorRef, label: string) {
  const taskId = nextId();
  const command: CreateTask = {
    commandId: nextId(),
    commandType: "task.create",
    actor: owner,
    idempotency: { key: `stage7-task-${label}-${taskId}`, requestFingerprint: fingerprint(`task:${label}`) },
    sourceContext: { surface: "stage7-integration" },
    payload: { taskId, title: label, commitmentState: "committed" },
  };
  await tasks.create(command);
  return await tasks.get(owner, taskId);
}

function planCommand(input: {
  readonly owner: ActorRef;
  readonly taskIds: readonly ReturnType<typeof nextId>[];
  readonly key: string;
  readonly seed: string;
  readonly planId?: ReturnType<typeof nextId>;
  readonly capacityMinutes?: number;
}): CommitDailyPlan {
  return {
    commandId: nextId(),
    commandType: "plan.commit-daily",
    actor: input.owner,
    idempotency: { key: input.key, requestFingerprint: fingerprint(input.seed) },
    sourceContext: { route: "/api/v1/plans/commit", surface: "stage7-integration" },
    payload: {
      planSnapshotId: input.planId ?? nextId(),
      date: localDate,
      timezone,
      capacityMinutes: input.capacityMinutes ?? 120,
      taskIds: input.taskIds,
      timeBlockIds: [],
    },
  };
}

function reviewCommand(input: {
  readonly owner: ActorRef;
  readonly baselineId: ReturnType<typeof nextId>;
  readonly finalId: ReturnType<typeof nextId>;
  readonly key: string;
  readonly seed: string;
  readonly reviewId?: ReturnType<typeof nextId>;
}): CreateReviewSnapshot {
  return {
    commandId: nextId(),
    commandType: "review.create-snapshot",
    actor: input.owner,
    idempotency: { key: input.key, requestFingerprint: fingerprint(input.seed) },
    sourceContext: { route: "/api/v1/reviews", surface: "stage7-integration" },
    payload: {
      reviewSnapshotId: input.reviewId ?? nextId(),
      date: localDate,
      timezone,
      baselinePlanSnapshotId: input.baselineId,
      finalPlanSnapshotId: input.finalId,
      executionRecordIds: [],
    },
  };
}

beforeAll(async () => {
  await pool.query("SELECT 1");
});

beforeEach(async () => {
  await pool.query(
    `UPDATE infra.outbox_events
        SET status='published', published_at=now(), claimed_at=NULL, claimed_by=NULL
      WHERE topic='capture.triage.requested' AND status<>'published'`,
  );
});

afterAll(async () => {
  await pool.end();
});

describe.sequential("Gate 4.1 Stage 7 Daily Loop", () => {
  it("retains the exact migration 0005 Planning slice after additive migration 0006", async () => {
    const history = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM drizzle.__drizzle_migrations",
    );
    expect(history.rows[0]?.count).toBe(7);
    const tables = await pool.query<{ name: string }>(
      `SELECT table_schema || '.' || table_name AS name
         FROM information_schema.tables
        WHERE (table_schema, table_name) IN (
          ('planning','plan_snapshots'),('planning','plan_snapshot_items'),
          ('planning','execution_records'),('planning','review_snapshots'))
        ORDER BY name`,
    );
    expect(tables.rows.map((row) => row.name)).toEqual([
      "planning.execution_records",
      "planning.plan_snapshot_items",
      "planning.plan_snapshots",
      "planning.review_snapshots",
    ]);
    const forbidden = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM information_schema.tables
        WHERE table_schema IN ('analytics','metrics','memory','notification')
           OR table_name IN ('today','daily_dashboard','ai_review_runs')`,
    );
    expect(forbidden.rows[0]?.count).toBe(0);
  });

  it("commits immutable Plan versions with exact replay, conflict, history and zero fake Core identity", async () => {
    const owner = await newActor("plan-history");
    const firstTask = await createTask(owner, "Plan A");
    const secondTask = await createTask(owner, "Plan B");
    const baselineId = nextId();
    const baseline = planCommand({
      owner,
      taskIds: [firstTask.id, secondTask.id],
      key: `plan-history-${baselineId}`,
      seed: "plan-history-v1",
      planId: baselineId,
    });
    const first = await dailyLoop.commitPlan(baseline);
    const replay = await dailyLoop.commitPlan(baseline);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(dailyLoop.commitPlan({
      ...baseline,
      idempotency: { ...baseline.idempotency, requestFingerprint: fingerprint("changed-plan") },
      payload: { ...baseline.payload, capacityMinutes: 121 },
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" } satisfies Partial<ApplicationError>);

    const initial = await dailyLoop.getToday(owner, localDate, timezone);
    expect(initial).toMatchObject({ id: baselineId, version: 1, capacityMinutes: 120 });
    expect(initial.items.map((item) => item.taskId)).toEqual([firstTask.id, secondTask.id]);
    const secondPlan = planCommand({
      owner,
      taskIds: [secondTask.id],
      key: `plan-history-v2-${nextId()}`,
      seed: "plan-history-v2",
    });
    await dailyLoop.commitPlan(secondPlan);
    const latest = await dailyLoop.getToday(owner, localDate, timezone);
    expect(latest).toMatchObject({ id: secondPlan.payload.planSnapshotId, version: 2 });
    await tasks.complete({
      commandId: nextId(),
      commandType: "task.complete",
      actor: owner,
      idempotency: { key: `plan-history-complete-${nextId()}`, requestFingerprint: fingerprint("plan-history-complete") },
      sourceContext: { surface: "stage7-integration" },
      baseRevision: Revision.parseBigInt(1n),
      payload: { taskId: firstTask.id },
    });
    const historical = await unitOfWork.transaction(({ planSnapshots }) => planSnapshots.getById(baselineId));
    expect(historical?.snapshot.items.map((item) => item.taskId)).toEqual([firstTask.id, secondTask.id]);

    const counts = await pool.query<{
      plans: number;
      items: number;
      changes: number;
      outbox: number;
      core_identity: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::integer FROM planning.plan_snapshots WHERE owner_id=$1) AS plans,
        (SELECT COUNT(*)::integer FROM planning.plan_snapshot_items item
          JOIN planning.plan_snapshots plan ON plan.id=item.plan_snapshot_id WHERE plan.owner_id=$1) AS items,
        (SELECT COUNT(*)::integer FROM audit.change_records WHERE target_type='plan_snapshot' AND actor_id=$1) AS changes,
        (SELECT COUNT(*)::integer FROM infra.outbox_events WHERE target_type='plan_snapshot'
          AND target_id IN (SELECT id FROM planning.plan_snapshots WHERE owner_id=$1)) AS outbox,
        (SELECT COUNT(*)::integer FROM core.objects WHERE id IN ($2,$3)) AS core_identity`,
      [owner.actorId, baselineId, secondPlan.payload.planSnapshotId],
    );
    expect(counts.rows[0]).toEqual({ plans: 2, items: 3, changes: 2, outbox: 2, core_identity: 0 });
  });

  it("serializes two distinct concurrent commits into unique versions", async () => {
    const owner = await newActor("plan-concurrency");
    const task = await createTask(owner, "Concurrent plan");
    const left = planCommand({ owner, taskIds: [task.id], key: `left-${nextId()}`, seed: "left" });
    const right = planCommand({ owner, taskIds: [task.id], key: `right-${nextId()}`, seed: "right" });
    await Promise.all([dailyLoop.commitPlan(left), dailyLoop.commitPlan(right)]);
    const rows = await pool.query<{ version: number }>(
      "SELECT version FROM planning.plan_snapshots WHERE owner_id=$1 AND local_date=$2 ORDER BY version",
      [owner.actorId, localDate],
    );
    expect(rows.rows.map((row) => row.version)).toEqual([1, 2]);
  });

  it("allows only one business mutation for concurrent duplicate Plan commits", async () => {
    const owner = await newActor("plan-duplicate");
    const task = await createTask(owner, "Duplicate plan");
    const command = planCommand({ owner, taskIds: [task.id], key: `duplicate-${nextId()}`, seed: "duplicate" });
    const results = await Promise.allSettled([dailyLoop.commitPlan(command), dailyLoop.commitPlan(command)]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const count = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM planning.plan_snapshots WHERE id=$1",
      [command.payload.planSnapshotId],
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it("completes a Task without fabricating ExecutionRecord actual timing", async () => {
    const owner = await newActor("no-fake-actual");
    const task = await createTask(owner, "No fake duration");
    const before = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM planning.execution_records WHERE owner_id=$1",
      [owner.actorId],
    );
    const command: CompleteTask = {
      commandId: nextId(),
      commandType: "task.complete",
      actor: owner,
      idempotency: { key: `complete-${nextId()}`, requestFingerprint: fingerprint("complete-no-actual") },
      sourceContext: { surface: "stage7-integration" },
      baseRevision: Revision.parseBigInt(1n),
      payload: { taskId: task.id },
    };
    await tasks.complete(command);
    const after = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM planning.execution_records WHERE owner_id=$1",
      [owner.actorId],
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it("creates an immutable deterministic Review, replays exactly and does not drift", async () => {
    const owner = await newActor("review-history");
    const task = await createTask(owner, "Review history");
    const plan = planCommand({ owner, taskIds: [task.id], key: `review-plan-${nextId()}`, seed: "review-plan" });
    await dailyLoop.commitPlan(plan);
    await tasks.complete({
      commandId: nextId(),
      commandType: "task.complete",
      actor: owner,
      idempotency: { key: `review-complete-${nextId()}`, requestFingerprint: fingerprint("review-complete") },
      sourceContext: { surface: "stage7-integration" },
      baseRevision: Revision.parseBigInt(1n),
      payload: { taskId: task.id },
    });
    const changedAfterReview = await createTask(owner, "Change after Review");
    const command = reviewCommand({
      owner,
      baselineId: plan.payload.planSnapshotId,
      finalId: plan.payload.planSnapshotId,
      key: `review-${nextId()}`,
      seed: "review-v1",
    });
    const first = await dailyLoop.createReview(command);
    const replay = await dailyLoop.createReview(command);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(dailyLoop.createReview({
      ...command,
      idempotency: { ...command.idempotency, requestFingerprint: fingerprint("review-changed") },
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" } satisfies Partial<ApplicationError>);

    const original = await dailyLoop.getReview(owner, localDate, timezone);
    expect(original).toMatchObject({
      id: command.payload.reviewSnapshotId,
      baselinePlanSnapshotId: plan.payload.planSnapshotId,
      finalPlanSnapshotId: plan.payload.planSnapshotId,
      executionRecordIds: [],
      derivedMetrics: { plannedCount: 1, actualExecutionCount: 0, actualDurationMinutes: 0 },
      aiInsightRefs: [],
    });
    expect(original.whatChanged).toContainEqual({ objectType: "task", id: task.id });

    await tasks.complete({
      commandId: nextId(),
      commandType: "task.complete",
      actor: owner,
      idempotency: { key: `post-review-complete-${nextId()}`, requestFingerprint: fingerprint("post-review-complete") },
      sourceContext: { surface: "stage7-integration" },
      baseRevision: Revision.parseBigInt(1n),
      payload: { taskId: changedAfterReview.id },
    });
    expect(await dailyLoop.getReview(owner, localDate, timezone)).toEqual(original);
    const rows = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM planning.review_snapshots
        WHERE owner_id=$1 AND local_date=$2`,
      [owner.actorId, localDate],
    );
    expect(rows.rows[0]?.count).toBe(1);
  });

  it("allows only one business mutation for concurrent duplicate Review creation", async () => {
    const owner = await newActor("review-duplicate");
    const task = await createTask(owner, "Review duplicate");
    const plan = planCommand({ owner, taskIds: [task.id], key: `review-dup-plan-${nextId()}`, seed: "review-dup-plan" });
    await dailyLoop.commitPlan(plan);
    const review = reviewCommand({
      owner,
      baselineId: plan.payload.planSnapshotId,
      finalId: plan.payload.planSnapshotId,
      key: `review-duplicate-${nextId()}`,
      seed: "review-duplicate",
    });
    const results = await Promise.allSettled([dailyLoop.createReview(review), dailyLoop.createReview(review)]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const count = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM planning.review_snapshots WHERE id=$1",
      [review.payload.reviewSnapshotId],
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it("keeps Today and Review actor-scoped and publishes actor-scoped SSE", async () => {
    const owner = await newActor("actor-owner");
    const foreign = await newActor("actor-foreign");
    const task = await createTask(owner, "Actor scoped");
    const stream = new PgSseEventStream(pool);
    const cursor = await stream.currentCursor();
    const plan = planCommand({ owner, taskIds: [task.id], key: `actor-plan-${nextId()}`, seed: "actor-plan" });
    await dailyLoop.commitPlan(plan);
    const review = reviewCommand({
      owner,
      baselineId: plan.payload.planSnapshotId,
      finalId: plan.payload.planSnapshotId,
      key: `actor-review-${nextId()}`,
      seed: "actor-review",
    });
    await dailyLoop.createReview(review);

    await expect(dailyLoop.getToday(foreign, localDate, timezone)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(dailyLoop.getReview(foreign, localDate, timezone)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const ownerEvents = await stream.replay(owner.actorId, cursor, ["object.changed"], 20);
    const foreignEvents = await stream.replay(foreign.actorId, cursor, ["object.changed"], 20);
    expect(ownerEvents.events.flatMap((event) => event.data.affectedRefs)).toEqual(expect.arrayContaining([
      { objectType: "plan_snapshot", id: plan.payload.planSnapshotId },
      { objectType: "review_snapshot", id: review.payload.reviewSnapshotId },
    ]));
    expect(foreignEvents.events).toHaveLength(0);
  });

  it("never dispatches ordinary Plan/Review projection events as Capture triage jobs", async () => {
    const owner = await newActor("dispatcher-regression");
    const task = await createTask(owner, "Dispatcher regression");
    const plan = planCommand({ owner, taskIds: [task.id], key: `dispatch-plan-${nextId()}`, seed: "dispatch-plan" });
    await dailyLoop.commitPlan(plan);
    await dailyLoop.createReview(reviewCommand({
      owner,
      baselineId: plan.payload.planSnapshotId,
      finalId: plan.payload.planSnapshotId,
      key: `dispatch-review-${nextId()}`,
      seed: "dispatch-review",
    }));
    const claim = await new PgCaptureTriageDispatchStore(pool).claimOne("stage7-regression", new Date(), 30_000);
    expect(claim).toBeNull();
    const topics = await pool.query<{ topic: string }>(
      `SELECT DISTINCT topic FROM infra.outbox_events
        WHERE target_type IN ('plan_snapshot','review_snapshot')
          AND target_id IN (
            SELECT id FROM planning.plan_snapshots WHERE owner_id=$1
            UNION ALL
            SELECT id FROM planning.review_snapshots WHERE owner_id=$1)`,
      [owner.actorId],
    );
    expect(topics.rows.map((row) => row.topic)).toEqual(["object.changed"]);
  });
});
