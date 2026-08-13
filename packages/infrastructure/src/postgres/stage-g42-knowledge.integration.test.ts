import {
  KnowledgeHandlers,
  type CreateLibrary,
  type RuntimeValues,
} from "@xiangxu/application";
import { UUIDv7, parseRfc3339Instant, type ActorRef } from "@xiangxu/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PgIdentityRepository } from "./identity-repository.js";
import { createPostgresPool } from "./pool.js";
import { PgUnitOfWork } from "./unit-of-work.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");

const pool = createPostgresPool(databaseUrl);
const identities = new PgIdentityRepository(pool);
const unitOfWork = new PgUnitOfWork(pool);
let sequence = 0xa000;

function nextId() {
  const middle = (sequence++).toString(16).padStart(4, "0");
  return UUIDv7.parse(`0198f1c0-${middle}-7abc-8def-0123456789ab`);
}

const runtime: RuntimeValues = {
  now: () => parseRfc3339Instant("2026-08-13T14:00:00.000Z"),
  newId: nextId,
};

function command(actor: ActorRef, libraryId: ReturnType<typeof nextId>, key: string): CreateLibrary {
  return {
    commandId: nextId(),
    commandType: "knowledge.library.create",
    actor,
    idempotency: { key, requestFingerprint: `sha256:${key.padEnd(64, "0").slice(0, 64)}` },
    sourceContext: { route: "/api/v1/libraries", surface: "knowledge-overview" },
    payload: { libraryId, name: "研究资料", description: "真实 Library Fact" },
  };
}

describe("Gate 4.2 Knowledge Library PostgreSQL slice", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE knowledge.libraries, audit.change_records, infra.outbox_events, infra.idempotency_keys, identity.device_sessions, identity.users RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates, replays and isolates one Library with audit and Outbox in the same transaction", async () => {
    const ownerId = await identities.ensureDevUser("g42-owner");
    const foreignId = await identities.ensureDevUser("g42-foreign");
    const actor = { actorType: "user", actorId: ownerId } as const;
    const foreign = { actorType: "user", actorId: foreignId } as const;
    const handlers = new KnowledgeHandlers(unitOfWork, runtime);
    const input = command(actor, nextId(), "knowledge-library-create-001");

    const created = await handlers.createLibrary(input);
    const replayed = await handlers.createLibrary(input);
    expect(created).toMatchObject({ status: 201, replayed: false });
    expect(replayed).toMatchObject({ status: 201, replayed: true, body: created.body });
    expect((await handlers.getOverview(actor)).libraries).toHaveLength(1);
    expect(await handlers.listLibraries(foreign)).toEqual([]);

    const state = await pool.query(`SELECT
      (SELECT count(*)::int FROM knowledge.libraries WHERE owner_id=$1) libraries,
      (SELECT count(*)::int FROM audit.change_records WHERE target_type='library' AND actor_id=$1) changes,
      (SELECT count(*)::int FROM infra.outbox_events WHERE target_type='library' AND topic='object.changed') outbox,
      (SELECT count(*)::int FROM infra.idempotency_keys WHERE command_type='knowledge.library.create') idempotency`, [ownerId]);
    expect(state.rows[0]).toEqual({ libraries: 1, changes: 1, outbox: 1, idempotency: 1 });
  });
});
