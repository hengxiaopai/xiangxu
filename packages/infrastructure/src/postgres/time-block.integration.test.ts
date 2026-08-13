/// <reference lib="dom" />

import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  ApplicationError,
  TimeBlockHandlers,
  type CreateTimeBlock,
  type MoveTimeBlock,
  type RuntimeValues,
} from "@xiangxu/application";
import {
  Revision,
  UUIDv7,
  createTask,
  createTimeBlock,
  parseIanaTimeZone,
  parseRfc3339Instant,
  type ActorRef,
  type Task,
} from "@xiangxu/domain";
import { PgIdentityRepository, PgUnitOfWork } from "../index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");

const pool = new Pool({ connectionString: databaseUrl, max: 12 });
const unitOfWork = new PgUnitOfWork(pool);
const identities = new PgIdentityRepository(pool);
const now = () => parseRfc3339Instant(new Date().toISOString());

async function databaseUuid() {
  const result = await pool.query<{ id: string }>("SELECT uuidv7()::text AS id");
  return UUIDv7.parse(result.rows[0]?.id ?? "");
}

async function runtime(): Promise<RuntimeValues> {
  const ids = [await databaseUuid(), await databaseUuid(), await databaseUuid(), await databaseUuid()];
  return {
    now,
    newId: () => {
      const id = ids.shift();
      if (id === undefined) throw new Error("Runtime ID fixture exhausted");
      return id;
    },
  };
}

async function fixture(label: string, dueOn = "2026-08-20") {
  const ownerId = await identities.ensureDevUser(`stage4-${label}-${Date.now()}-${Math.random()}`);
  const actor: ActorRef = { actorType: "user", actorId: ownerId };
  const task = createTask({
    id: await databaseUuid(),
    title: `Stage 4 ${label}`,
    ownerId,
    commitmentState: "committed",
    dueOn,
    createdAt: now(),
    createdBy: actor,
  });
  await unitOfWork.transaction((repositories) => repositories.tasks.insert({ task }));
  return { actor, task };
}

async function insertBlock(
  actor: ActorRef,
  task: Task,
  startAt: string,
  endAt: string,
  locked = false,
) {
  const block = createTimeBlock({
    id: await databaseUuid(),
    ownerId: actor.actorId,
    taskId: task.id,
    startAt,
    endAt,
    timezone: "Asia/Shanghai",
    locked,
    revision: Revision.parseBigInt(1n),
  });
  return unitOfWork.transaction((repositories) => repositories.timeBlocks.insert(block));
}

function createCommand(
  actor: ActorRef,
  taskId: Task["id"],
  timeBlockId: ReturnType<typeof UUIDv7.parse>,
  commandId: ReturnType<typeof UUIDv7.parse>,
  key: string,
  fingerprint: string,
  startAt: string,
  endAt: string,
): CreateTimeBlock {
  return {
    commandId,
    commandType: "timeblock.create",
    actor,
    idempotency: { key, requestFingerprint: fingerprint },
    sourceContext: { route: "/api/v1/time-blocks", surface: "stage4-integration" },
    payload: {
      timeBlockId,
      taskId,
      startAt: parseRfc3339Instant(startAt),
      endAt: parseRfc3339Instant(endAt),
      timezone: parseIanaTimeZone("Asia/Shanghai"),
      locked: false,
    },
  };
}

function moveCommand(
  actor: ActorRef,
  timeBlockId: ReturnType<typeof UUIDv7.parse>,
  commandId: ReturnType<typeof UUIDv7.parse>,
  key: string,
  fingerprint: string,
  startAt: string,
  endAt: string,
): MoveTimeBlock {
  return {
    commandId,
    commandType: "timeblock.move",
    actor,
    idempotency: { key, requestFingerprint: fingerprint },
    sourceContext: { route: `/api/v1/time-blocks/${timeBlockId}`, surface: "stage4-integration" },
    baseRevision: Revision.parseBigInt(1n),
    payload: {
      timeBlockId,
      startAt: parseRfc3339Instant(startAt),
      endAt: parseRfc3339Instant(endAt),
      timezone: parseIanaTimeZone("Asia/Shanghai"),
    },
  };
}

afterAll(async () => {
  await pool.end();
});

describe.sequential("Gate 4.1 Stage 4 TimeBlock PostgreSQL runtime", () => {
  it("retains the approved planning.time_blocks shape under later additive migrations", async () => {
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='planning' AND table_name='time_blocks' ORDER BY ordinal_position`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "id", "owner_id", "task_id", "start_at", "end_at", "timezone", "locked", "revision", "created_at", "updated_at",
    ]);
    const forbidden = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM information_schema.tables
       WHERE table_name IN ('today','daily_dashboard','today_cache_fact')`,
    );
    expect(forbidden.rows[0]?.count).toBe(0);
  });

  it("round-trips a TimeBlock and implements half-open overlap semantics", async () => {
    const { actor, task } = await fixture("half-open");
    const first = await insertBlock(actor, task, "2026-08-14T01:00:00.000Z", "2026-08-14T02:00:00.000Z");
    const adjacent = await insertBlock(actor, task, "2026-08-14T02:00:00.000Z", "2026-08-14T03:00:00.000Z");
    const read = await unitOfWork.transaction((repositories) => repositories.timeBlocks.getById(first.id));
    expect(read).toEqual(first);
    expect(await unitOfWork.transaction((repositories) => repositories.timeBlocks.findOverlap(
      actor.actorId,
      parseRfc3339Instant("2026-08-14T03:00:00.000Z"),
      parseRfc3339Instant("2026-08-14T04:00:00.000Z"),
    ))).toBeNull();
    expect((await unitOfWork.transaction((repositories) => repositories.timeBlocks.findOverlap(
      actor.actorId,
      parseRfc3339Instant("2026-08-14T01:30:00.000Z"),
      parseRfc3339Instant("2026-08-14T02:30:00.000Z"),
    )))?.id).toBe(first.id);
    expect(adjacent.revision).toBe(1n);
  });

  it("creates atomically, replays exactly, rejects a changed fingerprint, and leaves Task due/revision unchanged", async () => {
    const { actor, task } = await fixture("create-atomic", "2026-08-22");
    const before = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
    const blockId = await databaseUuid();
    const commandId = await databaseUuid();
    const command = createCommand(actor, task.id, blockId, commandId, "stage4-create-atomic", `sha256:${"a".repeat(64)}`, "2026-08-15T01:00:00.000Z", "2026-08-15T02:00:00.000Z");
    const handler = new TimeBlockHandlers(unitOfWork, await runtime());
    const first = await handler.create(command);
    const replay = await handler.create(command);
    expect(first).toMatchObject({ status: 201, etagRevision: 1n, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(handler.create({ ...command, idempotency: { ...command.idempotency, requestFingerprint: `sha256:${"b".repeat(64)}` } })).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    } satisfies Partial<ApplicationError>);
    const after = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
    expect({ dueOn: after?.dueOn, revision: after?.revision }).toEqual({ dueOn: before?.dueOn, revision: before?.revision });
    const artifacts = await pool.query<{ changes: number; events: number; blocks: number }>(
      `SELECT
        (SELECT COUNT(*)::integer FROM audit.change_records WHERE correlation_id=$1) AS changes,
        (SELECT COUNT(*)::integer FROM infra.outbox_events WHERE correlation_id=$1) AS events,
        (SELECT COUNT(*)::integer FROM planning.time_blocks WHERE id=$2) AS blocks`,
      [commandId, blockId],
    );
    expect(artifacts.rows[0]).toEqual({ changes: 1, events: 1, blocks: 1 });
  });

  it("denies foreign Task create and foreign TimeBlock move without orphan artifacts", async () => {
    const owner = await fixture("authority-owner");
    const foreign = await fixture("authority-foreign");
    const foreignBlock = await insertBlock(foreign.actor, foreign.task, "2026-08-16T01:00:00.000Z", "2026-08-16T02:00:00.000Z");
    const createId = await databaseUuid();
    const createBlockId = await databaseUuid();
    const create = createCommand(owner.actor, foreign.task.id, createBlockId, createId, "stage4-foreign-task", `sha256:${"c".repeat(64)}`, "2026-08-16T03:00:00.000Z", "2026-08-16T04:00:00.000Z");
    await expect(new TimeBlockHandlers(unitOfWork, await runtime()).create(create)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const moveId = await databaseUuid();
    const move = moveCommand(owner.actor, foreignBlock.id, moveId, "stage4-foreign-block", `sha256:${"d".repeat(64)}`, "2026-08-16T04:00:00.000Z", "2026-08-16T05:00:00.000Z");
    await expect(new TimeBlockHandlers(unitOfWork, await runtime()).move(move)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const counts = await pool.query<{ blocks: number; changes: number; events: number; keys: number }>(
      `SELECT
        (SELECT COUNT(*)::integer FROM planning.time_blocks WHERE id=$1) AS blocks,
        (SELECT COUNT(*)::integer FROM audit.change_records WHERE correlation_id IN ($2,$3)) AS changes,
        (SELECT COUNT(*)::integer FROM infra.outbox_events WHERE correlation_id IN ($2,$3)) AS events,
        (SELECT COUNT(*)::integer FROM infra.idempotency_keys WHERE idempotency_key IN ($4,$5)) AS keys`,
      [createBlockId, createId, moveId, create.idempotency.key, move.idempotency.key],
    );
    expect(counts.rows[0]).toEqual({ blocks: 0, changes: 0, events: 0, keys: 0 });
  });

  it("allows an authenticated user to move locked=true and exactly replays the old revision", async () => {
    const { actor, task } = await fixture("locked-user", "2026-08-24");
    const block = await insertBlock(actor, task, "2026-08-17T01:00:00.000Z", "2026-08-17T02:00:00.000Z", true);
    const commandId = await databaseUuid();
    const command = moveCommand(actor, block.id, commandId, "stage4-locked-user", `sha256:${"e".repeat(64)}`, "2026-08-17T02:00:00.000Z", "2026-08-17T03:00:00.000Z");
    const handler = new TimeBlockHandlers(unitOfWork, await runtime());
    const first = await handler.move(command);
    const replay = await handler.move(command);
    expect(first).toMatchObject({ status: 200, etagRevision: 2n, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    const current = await unitOfWork.transaction((repositories) => repositories.timeBlocks.getById(block.id));
    expect(current).toMatchObject({ startAt: "2026-08-17T02:00:00.000Z", endAt: "2026-08-17T03:00:00.000Z", locked: true, revision: 2n });
    const taskAfter = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
    expect(taskAfter).toMatchObject({ dueOn: "2026-08-24", revision: 1n });
  });

  it("rejects a system move of locked=true and rolls back its reservation", async () => {
    const { actor, task } = await fixture("locked-system");
    const block = await insertBlock(actor, task, "2026-08-18T01:00:00.000Z", "2026-08-18T02:00:00.000Z", true);
    const system: ActorRef = { actorType: "system", actorId: actor.actorId };
    const commandId = await databaseUuid();
    const command = moveCommand(system, block.id, commandId, "stage4-locked-system", `sha256:${"f".repeat(64)}`, "2026-08-18T02:00:00.000Z", "2026-08-18T03:00:00.000Z");
    await expect(new TimeBlockHandlers(unitOfWork, await runtime()).move(command)).rejects.toMatchObject({ code: "TIMEBLOCK_LOCKED" });
    const state = await pool.query<{ revision: string; changes: number; events: number; keys: number }>(
      `SELECT b.revision::text,
        (SELECT COUNT(*)::integer FROM audit.change_records WHERE correlation_id=$2) AS changes,
        (SELECT COUNT(*)::integer FROM infra.outbox_events WHERE correlation_id=$2) AS events,
        (SELECT COUNT(*)::integer FROM infra.idempotency_keys WHERE idempotency_key=$3) AS keys
       FROM planning.time_blocks b WHERE b.id=$1`,
      [block.id, commandId, command.idempotency.key],
    );
    expect(state.rows[0]).toEqual({ revision: "1", changes: 0, events: 0, keys: 0 });
  });

  it("permits exactly one concurrent CAS writer and never performs last-write-wins", async () => {
    const { actor, task } = await fixture("cas");
    const block = await insertBlock(actor, task, "2026-08-19T01:00:00.000Z", "2026-08-19T02:00:00.000Z");
    const attempt = (startAt: string, endAt: string) => unitOfWork.transaction((repositories) => repositories.timeBlocks.updateCas(
      block.id,
      Revision.parseBigInt(1n),
      { startAt: parseRfc3339Instant(startAt), endAt: parseRfc3339Instant(endAt), timezone: parseIanaTimeZone("Asia/Shanghai") },
    ));
    const results = await Promise.all([
      attempt("2026-08-19T02:00:00.000Z", "2026-08-19T03:00:00.000Z"),
      attempt("2026-08-19T03:00:00.000Z", "2026-08-19T04:00:00.000Z"),
    ]);
    expect(results.filter((result) => result.outcome === "updated")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "conflict")).toHaveLength(1);
  });

  it("serializes concurrent overlapping creates per owner so exactly one commits", async () => {
    const { actor, task } = await fixture("concurrent-overlap");
    const firstId = await databaseUuid();
    const secondId = await databaseUuid();
    const first = createCommand(actor, task.id, firstId, await databaseUuid(), "stage4-overlap-first", `sha256:${"1".repeat(64)}`, "2026-08-20T01:00:00.000Z", "2026-08-20T03:00:00.000Z");
    const second = createCommand(actor, task.id, secondId, await databaseUuid(), "stage4-overlap-second", `sha256:${"2".repeat(64)}`, "2026-08-20T02:00:00.000Z", "2026-08-20T04:00:00.000Z");
    const settled = await Promise.allSettled([
      new TimeBlockHandlers(unitOfWork, await runtime()).create(first),
      new TimeBlockHandlers(unitOfWork, await runtime()).create(second),
    ]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "TIMEBLOCK_CONFLICT" });
    const count = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM planning.time_blocks WHERE id IN ($1,$2)`,
      [firstId, secondId],
    );
    expect(count.rows[0]?.count).toBe(1);
  });
});
