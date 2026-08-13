/// <reference lib="dom" />

import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { Revision, UUIDv7, createTask, parseRfc3339Instant, type ActorRef, type ChangeRecord, type DurableEvent, type Task } from "@xiangxu/domain";
import type { IdempotencyKeyIdentity, TransactionRepositories } from "@xiangxu/application";
import { PgDeviceSessionRepository, PgIdempotencyRepository, PgIdentityRepository, PgUnitOfWork } from "../index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");

const pool = new Pool({ connectionString: databaseUrl, max: 12 });
const unitOfWork = new PgUnitOfWork(pool);
const identityRepository = new PgIdentityRepository(pool);
const sessionRepository = new PgDeviceSessionRepository(pool);
const idempotencyRepository = new PgIdempotencyRepository(pool);
let ownerId: ReturnType<typeof UUIDv7.parse>;
let actor: ActorRef;

const now = () => parseRfc3339Instant(new Date().toISOString());

async function databaseUuid() {
  const result = await pool.query<{ id: string }>("SELECT uuidv7()::text AS id");
  return UUIDv7.parse(result.rows[0]?.id ?? "");
}

async function newTask(title: string): Promise<Task> {
  const createdAt = now();
  return createTask({
    id: await databaseUuid(),
    title,
    ownerId,
    commitmentState: "committed",
    createdAt,
    createdBy: actor,
  });
}

async function insertTask(title: string) {
  const task = await newTask(title);
  return unitOfWork.transaction((repositories) => repositories.tasks.insert({ task }));
}

async function countForCorrelation(table: "audit.change_records" | "infra.outbox_events", correlationId: string) {
  const result = await pool.query<{ count: number }>(`SELECT COUNT(*)::integer AS count FROM ${table} WHERE correlation_id=$1`, [correlationId]);
  return result.rows[0]?.count ?? -1;
}

async function mutateTask(
  repositories: TransactionRepositories,
  task: Task,
  correlationId: ReturnType<typeof UUIDv7.parse>,
  failure?: "after-fact" | "after-change" | "before-commit",
) {
  const changedAt = now();
  const result = await repositories.tasks.updateCas(task.id, task.revision, {
    status: "completed",
    completedAt: changedAt,
    updatedAt: changedAt,
    updatedBy: actor,
  });
  if (result.outcome !== "updated") throw new Error("Unexpected CAS conflict in mutation fixture");
  if (failure === "after-fact") throw new Error("injected-after-fact");

  const change: ChangeRecord = {
    id: await databaseUuid(),
    entityRef: { objectType: "task", id: task.id },
    baseRevision: task.revision,
    newRevision: result.newRevision,
    actor,
    command: "status_change",
    changedFieldFamilies: ["status"],
    sourceContext: { surface: "stage2-integration" },
    correlationId,
    createdAt: changedAt,
  };
  await repositories.changes.append(change);
  if (failure === "after-change") throw new Error("injected-after-change");

  const event: DurableEvent = {
    eventId: await databaseUuid(),
    topic: "object.changed",
    affectedRefs: [{ objectType: "task", id: task.id }],
    projectionHints: ["today", "tasks"],
    revision: result.newRevision,
    commandId: correlationId,
    correlationId,
    occurredAt: changedAt,
  };
  await repositories.outbox.append(event);
  if (failure === "before-commit") throw new Error("injected-before-commit");
  return result.value;
}

beforeAll(async () => {
  ownerId = await identityRepository.ensureDevUser(`stage2-${Date.now()}`);
  actor = { actorType: "user", actorId: ownerId };
});

afterAll(async () => {
  await pool.end();
});

describe.sequential("Gate 4.1 Stage 2 PostgreSQL foundation", () => {
  it("retains the Stage 2 foundation under additive migrations", async () => {
    const history = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM drizzle.__drizzle_migrations`,
    );
    expect(history.rows[0]?.count).toBe(6);
    const required = await pool.query<{ name: string }>(
      `SELECT table_schema || '.' || table_name AS name FROM information_schema.tables
       WHERE (table_schema, table_name) IN (
         ('identity','users'),('identity','device_sessions'),('core','objects'),('core','task_details'),
         ('audit','change_records'),('infra','outbox_events'),('infra','idempotency_keys'),
         ('planning','time_blocks')) ORDER BY name`,
    );
    expect(required.rows.map((row) => row.name)).toHaveLength(8);
    const reviewSlice = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM information_schema.tables
       WHERE table_name IN ('plan_snapshots','plan_snapshot_items','execution_records','review_snapshots')`,
    );
    expect(reviewSlice.rows[0]?.count).toBe(4);
    const constraints = await pool.query<{ name: string }>(
      `SELECT conname AS name FROM pg_constraint
       WHERE conname IN ('objects_revision_positive','objects_type_task','task_details_commitment',
         'device_sessions_expiry_after_creation','idempotency_keys_actor_type_actor_id_command_type_idempotency_key_pk')
       ORDER BY conname`,
    );
    expect(constraints.rows.map((row) => row.name)).toHaveLength(5);
    const indexes = await pool.query<{ name: string }>(
      `SELECT indexname AS name FROM pg_indexes
       WHERE indexname IN ('users_dev_subject_unique','device_sessions_token_hash_unique','objects_owner_lookup_idx',
         'change_records_target_idx','change_records_correlation_idx','outbox_events_pending_idx',
         'outbox_events_correlation_idx','idempotency_created_idx') ORDER BY indexname`,
    );
    expect(indexes.rows.map((row) => row.name)).toHaveLength(8);
  });

  it("uses PostgreSQL 18 uuidv7() compatible with the Domain validator", async () => {
    const version = await pool.query<{ version: string }>("SELECT version()");
    expect(version.rows[0]?.version).toContain("PostgreSQL 18.4");
    const id = await databaseUuid();
    expect(UUIDv7.isValid(id)).toBe(true);
  });

  it("inserts and reads a Domain Task without exposing a DB row", async () => {
    const task = await insertTask("Stage 2 insert/read");
    const read = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
    expect(read).toEqual(task);
    expect(read).not.toHaveProperty("owner_id");
  });

  it("round-trips a revision above MAX_SAFE_INTEGER exactly", async () => {
    const task = await insertTask("Extreme bigint");
    await pool.query(`UPDATE core.objects SET revision=$2 WHERE id=$1`, [task.id, "9007199254740993"]);
    const read = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
    expect(read?.revision).toBe(9_007_199_254_740_993n);
  });

  it("performs real SQL CAS and rejects a stale base without mutation", async () => {
    const task = await insertTask("CAS success/stale");
    const changedAt = now();
    const first = await unitOfWork.transaction((repositories) => repositories.tasks.updateCas(task.id, Revision.parseBigInt(1n), {
      status: "completed", completedAt: changedAt, updatedAt: changedAt, updatedBy: actor,
    }));
    expect(first.outcome).toBe("updated");
    if (first.outcome !== "updated") throw new Error("Expected first CAS to update");
    expect(first.newRevision).toBe(2n);
    const stale = await unitOfWork.transaction((repositories) => repositories.tasks.updateCas(task.id, Revision.parseBigInt(1n), {
      status: "cancelled", updatedAt: now(), updatedBy: actor,
    }));
    expect(stale).toEqual({ outcome: "conflict" });
    const current = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
    expect(current?.status).toBe("completed");
    expect(current?.revision).toBe(2n);
  });

  it("allows exactly one of two concurrent writers with the same base revision", async () => {
    const task = await insertTask("Concurrent CAS");
    const attempt = (status: "completed" | "cancelled") => unitOfWork.transaction((repositories) =>
      repositories.tasks.updateCas(task.id, task.revision, {
        status,
        ...(status === "completed" ? { completedAt: now() } : {}),
        updatedAt: now(),
        updatedBy: actor,
      }),
    );
    const results = await Promise.all([attempt("completed"), attempt("cancelled")]);
    expect(results.filter((result) => result.outcome === "updated")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "conflict")).toHaveLength(1);
  });

  it("commits Fact + ChangeRecord + ordered Outbox in one transaction", async () => {
    const task = await insertTask("Atomic success");
    const correlationId = await databaseUuid();
    const updated = await unitOfWork.transaction((repositories) => mutateTask(repositories, task, correlationId));
    expect(updated.revision).toBe(2n);
    const records = await unitOfWork.transaction(async (repositories) => ({
      changes: await repositories.changes.readByCorrelationId(correlationId),
      outbox: await repositories.outbox.readByCorrelationId(correlationId),
    }));
    expect(records.changes).toHaveLength(1);
    expect(records.outbox).toHaveLength(1);
    expect(records.changes[0]?.newRevision).toBe(records.outbox[0]?.event.revision);
    expect(records.outbox[0]?.sequence).toBeGreaterThan(0n);
    const correlation = await pool.query<{
      change_command_id: string;
      outbox_command_id: string;
      correlation_id: string;
      target_id: string;
      new_revision: string;
      payload: { affectedRefs: unknown[]; projectionHints: string[] };
    }>(
      `SELECT c.command_id::text AS change_command_id, o.command_id::text AS outbox_command_id,
              o.correlation_id::text, o.target_id::text, o.revision::text AS new_revision, o.payload
         FROM audit.change_records c JOIN infra.outbox_events o USING (correlation_id)
        WHERE o.correlation_id=$1`, [correlationId],
    );
    expect(correlation.rows[0]).toEqual({
      change_command_id: correlationId,
      outbox_command_id: correlationId,
      correlation_id: correlationId,
      target_id: task.id,
      new_revision: "2",
      payload: {
        affectedRefs: [{ objectType: "task", id: task.id }],
        projectionHints: ["today", "tasks"],
      },
    });
  });

  for (const failure of ["after-fact", "after-change", "before-commit"] as const) {
    it(`rolls back without partial rows for failure ${failure}`, async () => {
      const task = await insertTask(`Rollback ${failure}`);
      const correlationId = await databaseUuid();
      await expect(unitOfWork.transaction((repositories) => mutateTask(repositories, task, correlationId, failure))).rejects.toThrow(`injected-${failure}`);
      const current = await unitOfWork.transaction((repositories) => repositories.tasks.getById(task.id));
      expect(current?.revision).toBe(1n);
      expect(current?.status).toBe("open");
      expect(await countForCorrelation("audit.change_records", correlationId)).toBe(0);
      expect(await countForCorrelation("infra.outbox_events", correlationId)).toBe(0);
    });
  }

  it("enforces ChangeRecord append-only at the database boundary", async () => {
    const row = await pool.query<{ id: string }>(`SELECT id::text FROM audit.change_records LIMIT 1`);
    const id = row.rows[0]?.id;
    expect(id).toBeDefined();
    await expect(pool.query(`UPDATE audit.change_records SET command='update' WHERE id=$1`, [id])).rejects.toThrow(/append-only/u);
  });

  it("reserves idempotency concurrently, stores exact replay, and rejects changed fingerprints", async () => {
    const task = await newTask("Idempotent insert");
    const key = await databaseUuid();
    const identity: IdempotencyKeyIdentity = {
      actor,
      commandType: "task.create",
      idempotencyKey: key,
      requestFingerprint: `sha256:${"a".repeat(64)}`,
    };
    const reservations = await Promise.all([idempotencyRepository.reserve(identity), idempotencyRepository.reserve(identity)]);
    expect(reservations.filter((item) => item.outcome === "first-execution")).toHaveLength(1);
    expect(reservations.filter((item) => item.outcome === "in-progress")).toHaveLength(1);
    await unitOfWork.transaction((repositories) => repositories.tasks.insert({ task }));
    await idempotencyRepository.complete(identity, { status: 201, body: { taskId: task.id }, etagRevision: task.revision });
    const replay = await idempotencyRepository.reserve(identity);
    expect(replay).toEqual({ outcome: "exact-replay", storedResult: { status: 201, body: { taskId: task.id }, etagRevision: 1n } });
    const conflict = await idempotencyRepository.reserve({ ...identity, requestFingerprint: `sha256:${"b".repeat(64)}` });
    expect(conflict).toEqual({ outcome: "conflict" });
    const taskCount = await pool.query<{ count: number }>(`SELECT COUNT(*)::integer AS count FROM core.objects WHERE id=$1`, [task.id]);
    expect(taskCount.rows[0]?.count).toBe(1);
  });

  it("persists only a session token hash and honors expiry/revocation", async () => {
    const testToken = "stage2-test-token-not-for-production";
    const tokenHash = createHash("sha256").update(testToken).digest("hex");
    const expiresAt = parseRfc3339Instant(new Date(Date.now() + 60_000).toISOString());
    const session = await sessionRepository.create({ userId: ownerId, tokenHash, expiresAt });
    const stored = await pool.query<{ token_hash: string; raw_matches: boolean }>(
      `SELECT token_hash, token_hash=$2 AS raw_matches FROM identity.device_sessions WHERE id=$1`,
      [session.id, testToken],
    );
    expect(stored.rows[0]).toEqual({ token_hash: tokenHash, raw_matches: false });
    expect(await sessionRepository.findActiveByTokenHash(tokenHash, now())).not.toBeNull();
    const afterExpiry = parseRfc3339Instant(new Date(Date.now() + 120_000).toISOString());
    expect(await sessionRepository.findActiveByTokenHash(tokenHash, afterExpiry)).toBeNull();
    expect(await sessionRepository.revoke(session.id, now())).toBe(true);
    expect(await sessionRepository.findActiveByTokenHash(tokenHash, now())).toBeNull();
  });
});
