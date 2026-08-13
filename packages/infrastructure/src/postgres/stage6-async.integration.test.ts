import { createHash } from "node:crypto";

import {
  CaptureHandlers,
  DeterministicStructuredProposalGenerator,
  ProposalHandlers,
  UnavailableProposalGenerator,
  type CreateCapture,
  type RuntimeValues,
} from "@xiangxu/application";
import { UUIDv7, parseRfc3339Instant, type ActorRef } from "@xiangxu/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BullMqCaptureTriageQueue,
  BullMqCaptureTriageWorker,
  OutboxDispatcher,
  PgCaptureTriageDispatchStore,
  type CaptureTriageJobIntent,
} from "../async/outbox-dispatcher.js";
import { PgIdentityRepository } from "./identity-repository.js";
import { createPostgresPool } from "./pool.js";
import { PgSseEventStream } from "./sse-event-stream.js";
import { PgUnitOfWork } from "./unit-of-work.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
if (redisUrl === undefined) throw new Error("REDIS_URL is required");

const pool = createPostgresPool(databaseUrl);
const unitOfWork = new PgUnitOfWork(pool);
let idCounter = 0;
const runtime: RuntimeValues = {
  now: () => parseRfc3339Instant(new Date().toISOString()),
  newId: () => UUIDv7.parse(databaseUuidSync()),
};
const captures = new CaptureHandlers(unitOfWork, runtime);
const proposals = new ProposalHandlers(unitOfWork, runtime, new DeterministicStructuredProposalGenerator());
const dispatchStore = new PgCaptureTriageDispatchStore(pool);
const stream = new PgSseEventStream(pool);

let owner: ActorRef;
let foreign: ActorRef;

beforeAll(async () => {
  const identities = new PgIdentityRepository(pool);
  owner = { actorType: "user", actorId: await identities.ensureDevUser(`stage6-owner-${Date.now()}`) };
  foreign = { actorType: "user", actorId: await identities.ensureDevUser(`stage6-foreign-${Date.now()}`) };
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query(
    `UPDATE infra.outbox_events
        SET status='published', published_at=now(), claimed_at=NULL, claimed_by=NULL
      WHERE topic='capture.triage.requested' AND status <> 'published'`,
  );
});

function databaseUuidSync(): string {
  const milliseconds = BigInt(Date.now());
  idCounter = (idCounter + 1) & 0xfff;
  const timestamp = milliseconds.toString(16).padStart(12, "0").slice(-12);
  const random = createHash("sha256").update(`${Date.now()}:${idCounter}:${Math.random()}`).digest("hex");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${idCounter.toString(16).padStart(3, "0")}-8${random.slice(0, 3)}-${random.slice(3, 15)}`;
}

function createCommand(actor: ActorRef, label: string): { command: CreateCapture; text: string } {
  const captureId = runtime.newId();
  const rawPayloadId = runtime.newId();
  const commandId = runtime.newId();
  const text = `Stage 6 ${label}`;
  return {
    text,
    command: {
      commandId,
      commandType: "capture.create",
      actor,
      idempotency: { key: `stage6-${label}-${commandId}`, requestFingerprint: `sha256:${createHash("sha256").update(label).digest("hex")}` },
      sourceContext: { surface: "stage6-integration" },
      payload: { captureId, rawPayloadId, rawPayloadKind: "text" },
    },
  };
}

async function createCapture(actor: ActorRef, label: string) {
  const fixture = createCommand(actor, label);
  const result = await captures.create(fixture.command, {
    text: fixture.text,
    contentHash: `sha256:${createHash("sha256").update(fixture.text).digest("hex")}`,
  });
  return { ...fixture, result };
}

function dispatcherQueue(queue: BullMqCaptureTriageQueue) {
  return { add: (intent: Parameters<BullMqCaptureTriageQueue["add"]>[0]) => queue.add(intent) };
}

async function realProposalWorker(
  redis: string,
  handler = proposals,
): Promise<BullMqCaptureTriageWorker> {
  const workerModuleUrl = new URL("../../../../apps/worker/dist/proposal-processor.js", import.meta.url);
  const workerModule = await import(workerModuleUrl.href) as {
    readonly ProposalGenerationProcessor: new (application: {
      generate(intent: {
        readonly outboxEventId: string;
        readonly outboxSequence: string;
        readonly captureId: string;
        readonly commandId: string;
        readonly correlationId: string;
      }): Promise<unknown>;
    }) => { process(intent: CaptureTriageJobIntent): Promise<unknown> };
  };
  const processor = new workerModule.ProposalGenerationProcessor({
    generate: (intent) => handler.generateFromDispatch({
      triggerEventId: UUIDv7.parse(intent.outboxEventId),
      captureId: UUIDv7.parse(intent.captureId),
      requestFingerprint: `sha256:${createHash("sha256").update(`capture.triage.requested:${intent.outboxEventId}`).digest("hex")}`,
    }),
  });
  return new BullMqCaptureTriageWorker(redis, (intent) => processor.process(intent));
}

async function waitForProposal(captureId: string, timeout = 10_000): Promise<number> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM ai.proposals proposal
       JOIN ai.proposal_targets target ON target.proposal_id=proposal.id
       WHERE target.target_type='capture_item' AND target.target_id=$1`,
      [captureId],
    );
    if ((result.rows[0]?.count ?? 0) > 0) return result.rows[0]?.count ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return 0;
}

describe("Stage 6 durable Capture triage dispatch", () => {
  it("atomically creates both distinct Outbox rows and exact replay creates neither again", async () => {
    const fixture = await createCapture(owner, "atomic-replay");
    const first = await pool.query<{ topic: string; count: number }>(
      `SELECT topic, count(*)::int count FROM infra.outbox_events WHERE correlation_id=$1 GROUP BY topic ORDER BY topic`,
      [fixture.command.commandId],
    );
    expect(first.rows).toEqual([
      { topic: "capture.triage.requested", count: 1 },
      { topic: "object.changed", count: 1 },
    ]);
    expect((await captures.create(fixture.command, {
      text: fixture.text,
      contentHash: `sha256:${createHash("sha256").update(fixture.text).digest("hex")}`,
    })).replayed).toBe(true);
    const after = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM infra.outbox_events WHERE correlation_id=$1`,
      [fixture.command.commandId],
    );
    expect(after.rows[0]?.count).toBe(2);
  });

  it("rolls back Capture and both events when the internal trigger append fails", async () => {
    const fixture = createCommand(owner, "trigger-rollback");
    const failing = new CaptureHandlers({
      transaction: (operation) => unitOfWork.transaction(async (repositories) => {
        const wrapped = {
          ...repositories,
          outbox: {
            ...repositories.outbox,
            append: repositories.outbox.append.bind(repositories.outbox),
            readByCorrelationId: repositories.outbox.readByCorrelationId.bind(repositories.outbox),
            appendCaptureTriageRequested: async () => { throw new Error("injected trigger failure"); },
          },
        };
        return operation(wrapped);
      }),
    }, runtime);
    await expect(failing.create(fixture.command, {
      text: fixture.text,
      contentHash: `sha256:${createHash("sha256").update(fixture.text).digest("hex")}`,
    })).rejects.toThrow("injected trigger failure");
    const state = await pool.query<{ captures: number; raws: number; changes: number; events: number; keys: number }>(
      `SELECT
        (SELECT count(*)::int FROM capture.capture_items WHERE id=$1) captures,
        (SELECT count(*)::int FROM capture.raw_payloads WHERE id=$2) raws,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$3) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$3) events,
        (SELECT count(*)::int FROM infra.idempotency_keys WHERE idempotency_key=$4) keys`,
      [fixture.command.payload.captureId, fixture.command.payload.rawPayloadId, fixture.command.commandId, fixture.command.idempotency.key],
    );
    expect(state.rows[0]).toEqual({ captures: 0, raws: 0, changes: 0, events: 0, keys: 0 });
  });

  it("rolls back after both Outbox rows when idempotency completion fails", async () => {
    const fixture = createCommand(owner, "post-trigger-rollback");
    const failing = new CaptureHandlers({
      transaction: (operation) => unitOfWork.transaction(async (repositories) => operation({
        ...repositories,
        idempotency: {
          reserve: repositories.idempotency.reserve.bind(repositories.idempotency),
          complete: async () => { throw new Error("injected completion failure"); },
        },
      })),
    }, runtime);
    await expect(failing.create(fixture.command, {
      text: fixture.text,
      contentHash: `sha256:${createHash("sha256").update(fixture.text).digest("hex")}`,
    })).rejects.toThrow("injected completion failure");
    const state = await pool.query<{ captures: number; raws: number; changes: number; events: number; keys: number }>(
      `SELECT
        (SELECT count(*)::int FROM capture.capture_items WHERE id=$1) captures,
        (SELECT count(*)::int FROM capture.raw_payloads WHERE id=$2) raws,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$3) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$3) events,
        (SELECT count(*)::int FROM infra.idempotency_keys WHERE idempotency_key=$4) keys`,
      [fixture.command.payload.captureId, fixture.command.payload.rawPayloadId, fixture.command.commandId, fixture.command.idempotency.key],
    );
    expect(state.rows[0]).toEqual({ captures: 0, raws: 0, changes: 0, events: 0, keys: 0 });
  });

  it("uses SKIP LOCKED so two dispatchers obtain one active owner", async () => {
    const fixture = await createCapture(owner, "concurrent-claim");
    const now = new Date();
    const [left, right] = await Promise.all([
      dispatchStore.claimOne("dispatcher-left", now, 30_000),
      dispatchStore.claimOne("dispatcher-right", now, 30_000),
    ]);
    expect([left, right].filter(Boolean)).toHaveLength(1);
    const claimed = left ?? right;
    expect(claimed?.captureId).toBe(fixture.command.payload.captureId);
  });

  it("does not steal a fresh claim and reclaims a stale claim", async () => {
    const fixture = await createCapture(owner, "lease-reclaim");
    const availability = await pool.query<{ available_at: Date }>(
      `SELECT available_at
         FROM infra.outbox_events
        WHERE correlation_id=$1 AND topic='capture.triage.requested'`,
      [fixture.command.commandId],
    );
    const availableAt = availability.rows[0]?.available_at;
    if (availableAt === undefined) throw new Error("Lease fixture Outbox row was not created");
    const claimedAt = new Date(availableAt.getTime() + 1);
    const first = await dispatchStore.claimOne("lease-first", claimedAt, 1_000);
    expect(first?.captureId).toBe(fixture.command.payload.captureId);
    expect(await dispatchStore.claimOne("lease-fresh", new Date(claimedAt.getTime() + 500), 1_000)).toBeNull();
    const reclaimed = await dispatchStore.claimOne("lease-reclaimed", new Date(claimedAt.getTime() + 1_001), 1_000);
    expect(reclaimed?.outboxEventId).toBe(first?.outboxEventId);
    expect(reclaimed?.attempts).toBe((first?.attempts ?? 0) + 1);
  });

  it("keeps a committed Capture retryable while Redis is unavailable", async () => {
    const fixture = await createCapture(owner, "redis-down");
    const unavailable = new BullMqCaptureTriageQueue("redis://127.0.0.1:56378/0");
    try {
      await expect(new OutboxDispatcher(dispatchStore, dispatcherQueue(unavailable), "redis-down", 1_000, 1).dispatchOne()).rejects.toThrow();
    } finally {
      await unavailable.close().catch(() => undefined);
    }
    const state = await pool.query<{ status: string; available: boolean; captures: number; raws: number }>(
      `SELECT event.status, event.available_at <= now() available,
        (SELECT count(*)::int FROM capture.capture_items WHERE id=$1) captures,
        (SELECT count(*)::int FROM capture.raw_payloads WHERE id=$2) raws
       FROM infra.outbox_events event
       WHERE event.correlation_id=$3 AND event.topic='capture.triage.requested'`,
      [fixture.command.payload.captureId, fixture.command.payload.rawPayloadId, fixture.command.commandId],
    );
    expect(state.rows[0]).toMatchObject({ status: "failed", captures: 1, raws: 1 });
  }, 10_000);

  it("recovers both crash windows and duplicate delivery to one Proposal effect", async () => {
    const queue = new BullMqCaptureTriageQueue(redisUrl);
    await queue.waitUntilReady();
    await queue.obliterate();
    const worker = await realProposalWorker(redisUrl);
    try {
      const beforeAdd = await createCapture(owner, "crash-before-add");
      await expect(new OutboxDispatcher(dispatchStore, dispatcherQueue(queue), "crash-a", 1).dispatchOne(new Date(), {
        afterClaim: () => { throw new Error("crash before queue.add"); },
      })).rejects.toThrow("crash before queue.add");
      await new Promise((resolve) => setTimeout(resolve, 5));
      await worker.waitUntilReady();
      await new OutboxDispatcher(dispatchStore, dispatcherQueue(queue), "recover-a", 1).dispatchOne();
      expect(await waitForProposal(beforeAdd.command.payload.captureId)).toBe(1);

      const afterAdd = await createCapture(owner, "crash-after-add");
      await expect(new OutboxDispatcher(dispatchStore, dispatcherQueue(queue), "crash-b", 1).dispatchOne(new Date(), {
        afterEnqueue: () => { throw new Error("crash after queue.add"); },
      })).rejects.toThrow("crash after queue.add");
      await new Promise((resolve) => setTimeout(resolve, 5));
      await new OutboxDispatcher(dispatchStore, dispatcherQueue(queue), "recover-b", 1).dispatchOne();
      expect(await waitForProposal(afterAdd.command.payload.captureId)).toBe(1);

      const trigger = await pool.query<{ id: string; sequence: string; target_id: string; command_id: string; correlation_id: string }>(
        `SELECT id::text, sequence::text, target_id::text, command_id::text, correlation_id::text
         FROM infra.outbox_events WHERE correlation_id=$1 AND topic='capture.triage.requested'`,
        [afterAdd.command.commandId],
      );
      const row = trigger.rows[0];
      if (row === undefined) throw new Error("missing trigger");
      const duplicate = { outboxEventId: row.id, outboxSequence: row.sequence, captureId: row.target_id, commandId: row.command_id, correlationId: row.correlation_id };
      await proposals.generateFromDispatch({
        triggerEventId: UUIDv7.parse(duplicate.outboxEventId),
        captureId: UUIDv7.parse(duplicate.captureId),
        requestFingerprint: `sha256:${createHash("sha256").update(`capture.triage.requested:${duplicate.outboxEventId}`).digest("hex")}`,
      });
      expect(await waitForProposal(afterAdd.command.payload.captureId)).toBe(1);
    } finally {
      await worker.close(true).catch(() => undefined);
      await queue.obliterate().catch(() => undefined);
      await queue.close();
    }
  });

  it("worker unavailability preserves queued job until a worker starts", async () => {
    const queue = new BullMqCaptureTriageQueue(redisUrl);
    await queue.waitUntilReady();
    await queue.obliterate();
    const fixture = await createCapture(owner, "worker-restart");
    const dispatched = await new OutboxDispatcher(dispatchStore, dispatcherQueue(queue), "worker-down").dispatchOne();
    expect(dispatched?.captureId).toBe(fixture.command.payload.captureId);
    expect(await queue.jobState(dispatched?.outboxEventId ?? "")).toBe("waiting");
    const worker = await realProposalWorker(redisUrl);
    try {
      await worker.waitUntilReady();
      expect(await waitForProposal(fixture.command.payload.captureId)).toBe(1);
    } finally {
      await worker.close(true).catch(() => undefined);
      await queue.obliterate().catch(() => undefined);
      await queue.close();
    }
  });

  it("observes AI unavailability through the real queue without corrupting Capture", async () => {
    const queue = new BullMqCaptureTriageQueue(redisUrl);
    await queue.waitUntilReady();
    await queue.obliterate();
    const fixture = await createCapture(owner, "ai-unavailable");
    const unavailableHandler = new ProposalHandlers(unitOfWork, runtime, new UnavailableProposalGenerator());
    const worker = await realProposalWorker(redisUrl, unavailableHandler);
    try {
      await worker.waitUntilReady();
      const dispatched = await new OutboxDispatcher(dispatchStore, dispatcherQueue(queue), "ai-unavailable").dispatchOne();
      if (dispatched === null) throw new Error("AI unavailable fixture was not dispatched");
      const deadline = Date.now() + 10_000;
      let state: string | undefined;
      while (Date.now() < deadline) {
        state = await queue.jobState(dispatched.outboxEventId);
        if (state === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(state).toBe("failed");
      const database = await pool.query<{ captures: number; raws: number; proposals: number; ready_events: number }>(
        `SELECT
          (SELECT count(*)::int FROM capture.capture_items WHERE id=$1) captures,
          (SELECT count(*)::int FROM capture.raw_payloads WHERE id=$2) raws,
          (SELECT count(*)::int FROM ai.proposal_targets WHERE target_id=$1) proposals,
          (SELECT count(*)::int FROM infra.outbox_events WHERE target_id=$1 AND topic='proposal.ready') ready_events`,
        [fixture.command.payload.captureId, fixture.command.payload.rawPayloadId],
      );
      expect(database.rows[0]).toEqual({ captures: 1, raws: 1, proposals: 0, ready_events: 0 });
    } finally {
      await worker.close(true).catch(() => undefined);
      await queue.obliterate().catch(() => undefined);
      await queue.close();
    }
  });
});

describe("Stage 6 PostgreSQL SSE stream", () => {
  it("is actor scoped, ordered, bigint-safe, and excludes the internal trigger", async () => {
    const cursor = await stream.currentCursor();
    const owned = await createCapture(owner, "sse-owner");
    await createCapture(foreign, "sse-foreign");
    const batch = await stream.replay(owner.actorId, cursor, ["object.changed", "proposal.ready"], 20);
    expect(batch.resyncRequired).toBe(false);
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]?.event).toBe("object.changed");
    expect(batch.events[0]?.data.affectedRefs).toEqual([{ objectType: "capture_item", id: owned.command.payload.captureId }]);
    expect(batch.events.map((event) => BigInt(event.id))).toEqual([...batch.events].map((event) => BigInt(event.id)).sort((a, b) => a < b ? -1 : 1));
    expect(JSON.stringify(batch.events)).not.toContain("capture.triage.requested");
    expect(JSON.stringify(batch.events)).not.toContain(owned.text);
  });

  it("replays after Last-Event-ID and counts only actor-owned eligible events for bounded resync", async () => {
    const cursor = await stream.currentCursor();
    await createCapture(owner, "replay-one");
    await createCapture(owner, "replay-two");
    await createCapture(foreign, "replay-foreign");
    const first = await stream.replay(owner.actorId, cursor, ["object.changed", "proposal.ready"], 10);
    expect(first.events).toHaveLength(2);
    const replay = await stream.replay(owner.actorId, first.events[0]?.id ?? cursor, ["object.changed", "proposal.ready"], 10);
    expect(replay.events).toHaveLength(1);
    expect(replay.events[0]?.id).toBe(first.events[1]?.id);
    const bounded = await stream.replay(owner.actorId, cursor, ["object.changed", "proposal.ready"], 1);
    expect(bounded.resyncRequired).toBe(true);
    expect(bounded.events).toEqual([]);
    const internalCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM infra.outbox_events WHERE sequence>$1 AND topic='capture.triage.requested'`,
      [cursor],
    );
    expect(internalCount.rows[0]?.count).toBe(3);
  });
});
