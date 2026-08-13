/// <reference lib="dom" />

import { createHash } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  ApplicationError,
  CaptureHandlers,
  DeterministicStructuredProposalGenerator,
  ProposalHandlers,
  UnavailableProposalGenerator,
  type ApplyProposal,
  type CreateCapture,
  type GenerateStructuredTriageProposal,
  type RuntimeValues,
  type StructuredProposalGenerator,
  type TransactionRepositories,
  type UnitOfWork,
} from "@xiangxu/application";
import { Revision, UUIDv7, parseRfc3339Instant, type ActorRef } from "@xiangxu/domain";
import { PgIdentityRepository, PgUnitOfWork } from "../index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");

const pool = new Pool({ connectionString: databaseUrl, max: 16 });
const unitOfWork = new PgUnitOfWork(pool);
const identities = new PgIdentityRepository(pool);
let idCounter = 0x7000;

function nextId() {
  const middle = (idCounter++).toString(16).padStart(4, "0");
  return UUIDv7.parse(`0198f1a0-${middle}-7abc-8def-0123456789ab`);
}

const runtime: RuntimeValues = {
  now: () => parseRfc3339Instant(new Date().toISOString()),
  newId: nextId,
};

const fingerprint = (seed: string) => `sha256:${createHash("sha256").update(seed).digest("hex")}`;
const contentHash = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

async function actor(label: string): Promise<ActorRef> {
  return { actorType: "user", actorId: await identities.ensureDevUser(`stage5-${label}-${nextId()}`) };
}

function captureCommand(owner: ActorRef, key: string, text: string): { command: CreateCapture; text: string } {
  return {
    text,
    command: {
      commandId: nextId(),
      commandType: "capture.create",
      actor: owner,
      idempotency: { key, requestFingerprint: fingerprint(`capture:${text}`) },
      sourceContext: { route: "/api/v1/captures", surface: "stage5-integration" },
      payload: { captureId: nextId(), rawPayloadId: nextId(), rawPayloadKind: "text" },
    },
  };
}

async function createCapture(owner: ActorRef, label: string, text = `Capture ${label}`) {
  const fixture = captureCommand(owner, `stage5-capture-${label}`, text);
  const result = await new CaptureHandlers(unitOfWork, runtime).create(fixture.command, {
    text,
    contentHash: contentHash(text),
  });
  return { ...fixture, result };
}

function generationCommand(owner: ActorRef, captureId: ReturnType<typeof nextId>, key: string): GenerateStructuredTriageProposal {
  return {
    commandId: nextId(),
    commandType: "proposal.generate-structured-triage",
    actor: { actorType: "system", actorId: owner.actorId },
    idempotency: { key, requestFingerprint: fingerprint(`generate:${captureId}`) },
    sourceContext: { route: `/api/v1/captures/${captureId}/triage-proposals`, surface: "stage5-worker" },
    payload: { captureId },
  };
}

async function generateProposal(owner: ActorRef, captureId: ReturnType<typeof nextId>, label: string) {
  const command = generationCommand(owner, captureId, `stage5-generate-${label}`);
  const result = await new ProposalHandlers(
    unitOfWork,
    runtime,
    new DeterministicStructuredProposalGenerator(),
  ).generate(command);
  const proposalRef = (result.body.affectedRefs as { objectType: string; id: ReturnType<typeof nextId> }[])[0];
  if (proposalRef?.objectType !== "proposal") throw new Error("Generation did not return a Proposal ref");
  return { command, result, proposalId: proposalRef.id };
}

function applyCommand(
  owner: ActorRef,
  proposalId: ReturnType<typeof nextId>,
  captureId: ReturnType<typeof nextId>,
  baseRevision: bigint,
  key: string,
): ApplyProposal {
  return {
    commandId: nextId(),
    commandType: "proposal.apply",
    actor: owner,
    idempotency: { key, requestFingerprint: fingerprint(`apply:${proposalId}:${captureId}:${baseRevision}`) },
    sourceContext: { route: `/api/v1/proposals/${proposalId}/apply`, surface: "stage5-integration" },
    payload: {
      proposalId,
      targets: [{ ref: { objectType: "capture_item", id: captureId }, baseRevision: Revision.parseBigInt(baseRevision) }],
    },
  };
}

afterAll(async () => {
  await pool.end();
});

describe.sequential("Gate 4.1 Stage 5 Capture / Proposal / Apply PostgreSQL runtime", () => {
  it("retains exactly the four approved Stage 5 tables under later additive infrastructure", async () => {
    const actual = await pool.query<{ name: string }>(
      `SELECT table_schema || '.' || table_name AS name FROM information_schema.tables
       WHERE (table_schema='capture' OR table_schema='ai') ORDER BY name`,
    );
    expect(actual.rows.map(({ name }) => name)).toEqual([
      "ai.proposal_targets", "ai.proposals", "capture.capture_items", "capture.raw_payloads",
    ]);
    const forbidden = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM information_schema.tables
       WHERE table_name IN ('runs','messages','embeddings','daily_dashboard','ai_review_runs')`,
    );
    expect(forbidden.rows[0]?.count).toBe(0);
  });

  it("creates raw payload + Capture + audit + pending Outbox atomically and replays exactly", async () => {
    const owner = await actor("capture-atomic");
    const fixture = captureCommand(owner, "stage5-capture-atomic", "Call the supplier tomorrow");
    const handler = new CaptureHandlers(unitOfWork, runtime);
    const first = await handler.create(fixture.command, { text: fixture.text, contentHash: contentHash(fixture.text) });
    const replay = await handler.create(fixture.command, { text: fixture.text, contentHash: contentHash(fixture.text) });
    expect(first).toMatchObject({ status: 201, etagRevision: 1n, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(handler.create(
      { ...fixture.command, idempotency: { ...fixture.command.idempotency, requestFingerprint: fingerprint("changed") } },
      { text: "Changed payload", contentHash: contentHash("Changed payload") },
    )).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" } satisfies Partial<ApplicationError>);
    const state = await pool.query(
      `SELECT r.text_content, r.content_hash, c.revision::text, c.triage_status,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$3) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$3 AND status='pending') outbox
       FROM capture.capture_items c JOIN capture.raw_payloads r ON r.id=c.raw_payload_id
       WHERE c.id=$1 AND r.id=$2`,
      [fixture.command.payload.captureId, fixture.command.payload.rawPayloadId, fixture.command.commandId],
    );
    expect(state.rows[0]).toEqual({
      text_content: fixture.text,
      content_hash: contentHash(fixture.text),
      revision: "1",
      triage_status: "untriaged",
      changes: 1,
      outbox: 2,
    });
    const outboxPayload = await pool.query(`SELECT payload::text FROM infra.outbox_events WHERE correlation_id=$1`, [fixture.command.commandId]);
    expect(outboxPayload.rows[0]?.payload).not.toContain(fixture.text);
  });

  it("permits only one business mutation for concurrent exact Capture replay", async () => {
    const owner = await actor("capture-concurrent");
    const fixture = captureCommand(owner, "stage5-capture-concurrent", "Concurrent capture");
    const execute = () => new CaptureHandlers(unitOfWork, runtime).create(fixture.command, {
      text: fixture.text, contentHash: contentHash(fixture.text),
    });
    const settled = await Promise.allSettled([execute(), execute()]);
    expect(settled.filter(({ status }) => status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const count = await pool.query<{ raw: number; captures: number }>(
      `SELECT
        (SELECT count(*)::int FROM capture.raw_payloads WHERE id=$1) raw,
        (SELECT count(*)::int FROM capture.capture_items WHERE id=$2) captures`,
      [fixture.command.payload.rawPayloadId, fixture.command.payload.captureId],
    );
    expect(count.rows[0]).toEqual({ raw: 1, captures: 1 });
  });

  it("generates a deterministic ready Proposal as system without changing Capture or raw payload", async () => {
    const owner = await actor("proposal-ready");
    const captured = await createCapture(owner, "proposal-ready", "  Draft   quarterly plan  ");
    const tasksBefore = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner.actorId],
    );
    const generated = await generateProposal(owner, captured.command.payload.captureId, "proposal-ready");
    expect(generated.result).toMatchObject({ status: 202, replayed: false });
    expect(generated.result).not.toHaveProperty("etagRevision");
    const state = await pool.query(
      `SELECT p.proposal_type, p.structured_patch, p.status, p.created_by_type,
              t.target_type, t.target_id::text, t.base_revision::text,
              c.revision::text capture_revision, c.triage_status, r.text_content
         FROM ai.proposals p JOIN ai.proposal_targets t ON t.proposal_id=p.id
         JOIN capture.capture_items c ON c.id=t.target_id
         JOIN capture.raw_payloads r ON r.id=c.raw_payload_id
        WHERE p.id=$1`,
      [generated.proposalId],
    );
    expect(state.rows[0]).toMatchObject({
      proposal_type: "create",
      structured_patch: {
        kind: "task.create",
        captureId: captured.command.payload.captureId,
        task: { title: "Draft quarterly plan", commitmentState: "someday" },
      },
      status: "ready",
      created_by_type: "system",
      target_type: "capture_item",
      target_id: captured.command.payload.captureId,
      base_revision: "1",
      capture_revision: "1",
      triage_status: "untriaged",
      text_content: captured.text,
    });
    const tasksAfter = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner.actorId],
    );
    expect(tasksAfter.rows[0]?.count).toBe(tasksBefore.rows[0]?.count);
    const readyOutbox = await pool.query(`SELECT payload::text FROM infra.outbox_events WHERE correlation_id=$1`, [generated.command.commandId]);
    expect(readyOutbox.rows[0]?.payload).not.toContain(captured.text);
  });

  it.each([
    ["invalid", { generate: async () => ({ proposalType: "create" }) } satisfies StructuredProposalGenerator, undefined],
    ["unavailable", new UnavailableProposalGenerator(), "AI_UNAVAILABLE"],
  ] as const)("keeps Capture canonical and persists no Proposal when generator is %s", async (label, generator, code) => {
    const owner = await actor(`generator-${label}`);
    const captured = await createCapture(owner, `generator-${label}`);
    const command = generationCommand(owner, captured.command.payload.captureId, `stage5-generator-${label}`);
    const execution = new ProposalHandlers(unitOfWork, runtime, generator).generate(command);
    if (code === undefined) await expect(execution).rejects.toThrow();
    else await expect(execution).rejects.toMatchObject({ code });
    const sideEffects = await pool.query<{ proposals: number; changes: number; outbox: number; keys: number }>(
      `SELECT
        (SELECT count(*)::int FROM ai.proposal_targets WHERE target_type='capture_item' AND target_id=$1) proposals,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$2) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$2) outbox,
        (SELECT count(*)::int FROM infra.idempotency_keys WHERE idempotency_key=$3) keys`,
      [captured.command.payload.captureId, command.commandId, command.idempotency.key],
    );
    expect(sideEffects.rows[0]).toEqual({ proposals: 0, changes: 0, outbox: 0, keys: 0 });
    const capture = await unitOfWork.transaction(({ captures }) => captures.getWithRawPayload(captured.command.payload.captureId));
    expect(capture).toMatchObject({ capture: { revision: 1n, triageStatus: "untriaged" }, rawPayload: { textContent: captured.text } });
  });

  it("applies typed task.create atomically, preserves history, and exact replay does not increment twice", async () => {
    const owner = await actor("apply-success");
    const captured = await createCapture(owner, "apply-success", "Create launch checklist");
    const generated = await generateProposal(owner, captured.command.payload.captureId, "apply-success");
    const proposalBefore = await pool.query(`SELECT structured_patch, rationale, evidence_refs, impact_summary, risk_level, created_by_type, created_by_id FROM ai.proposals WHERE id=$1`, [generated.proposalId]);
    const command = applyCommand(owner, generated.proposalId, captured.command.payload.captureId, 1n, "stage5-apply-success");
    const handler = new ProposalHandlers(unitOfWork, runtime, new DeterministicStructuredProposalGenerator());
    const first = await handler.apply(command);
    const replay = await handler.apply(command);
    expect(first).toMatchObject({ status: 200, replayed: false });
    expect(first).not.toHaveProperty("etagRevision");
    expect(replay).toEqual({ ...first, replayed: true });
    const affected = first.body.affectedRefs as { objectType: string; id: string }[];
    const taskId = affected.find(({ objectType }) => objectType === "task")?.id;
    expect(taskId).toBeDefined();
    const state = await pool.query(
      `SELECT p.status, p.structured_patch, p.rationale, p.evidence_refs, p.impact_summary,
              p.risk_level, p.created_by_type, p.created_by_id,
              c.revision::text capture_revision, c.triage_status, c.proposal_id::text,
              c.materialized_object_ids::text[], r.text_content,
              o.revision::text task_revision, o.title, o.owner_id::text
         FROM ai.proposals p JOIN capture.capture_items c ON c.id=$2
         JOIN capture.raw_payloads r ON r.id=c.raw_payload_id
         JOIN core.objects o ON o.id=$3
        WHERE p.id=$1`,
      [generated.proposalId, captured.command.payload.captureId, taskId],
    );
    expect(state.rows[0]).toMatchObject({
      status: "applied",
      capture_revision: "2",
      triage_status: "accepted",
      proposal_id: generated.proposalId,
      materialized_object_ids: [taskId],
      text_content: captured.text,
      task_revision: "1",
      title: captured.text,
      owner_id: owner.actorId,
    });
    expect({
      structured_patch: state.rows[0].structured_patch,
      rationale: state.rows[0].rationale,
      evidence_refs: state.rows[0].evidence_refs,
      impact_summary: state.rows[0].impact_summary,
      risk_level: state.rows[0].risk_level,
      created_by_type: state.rows[0].created_by_type,
      created_by_id: state.rows[0].created_by_id,
    }).toEqual(proposalBefore.rows[0]);
    const applyArtifacts = await pool.query<{ changes: number; outbox: number }>(
      `SELECT
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$1) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$1) outbox`,
      [command.commandId],
    );
    expect(applyArtifacts.rows[0]).toEqual({ changes: 3, outbox: 2 });
  });

  it("rejects stale Proposal without Fact, lifecycle, audit, Outbox, or idempotency mutation", async () => {
    const owner = await actor("apply-stale");
    const captured = await createCapture(owner, "apply-stale");
    const generated = await generateProposal(owner, captured.command.payload.captureId, "apply-stale");
    await pool.query(`UPDATE capture.capture_items SET revision=revision+1 WHERE id=$1`, [captured.command.payload.captureId]);
    const command = applyCommand(owner, generated.proposalId, captured.command.payload.captureId, 1n, "stage5-apply-stale");
    const tasksBefore = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner.actorId],
    );
    await expect(new ProposalHandlers(unitOfWork, runtime, new DeterministicStructuredProposalGenerator()).apply(command)).rejects.toMatchObject({ code: "PROPOSAL_STALE" });
    const state = await pool.query<{ status: string; changes: number; outbox: number; tasks: number }>(
      `SELECT p.status,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$2) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$2) outbox,
        (SELECT count(*)::int FROM core.objects WHERE owner_id=$3) tasks
       FROM ai.proposals p WHERE p.id=$1`,
      [generated.proposalId, command.commandId, owner.actorId],
    );
    expect(state.rows[0]).toEqual({ status: "ready", changes: 0, outbox: 0, tasks: tasksBefore.rows[0]?.count });
    const key = await pool.query(`SELECT count(*)::int count FROM infra.idempotency_keys WHERE idempotency_key=$1`, [command.idempotency.key]);
    expect(key.rows[0]?.count).toBe(0);
  });

  it("rolls back Task and Proposal lifecycle when Capture CAS loses after validation", async () => {
    const owner = await actor("apply-cas-race");
    const captured = await createCapture(owner, "apply-cas-race");
    const generated = await generateProposal(owner, captured.command.payload.captureId, "apply-cas-race");
    const command = applyCommand(owner, generated.proposalId, captured.command.payload.captureId, 1n, "stage5-apply-cas-race");
    let injected = false;
    const racingUnitOfWork: UnitOfWork = {
      transaction: (operation) => unitOfWork.transaction((repositories) => operation({
        ...repositories,
        captures: {
          insertRawPayload: (payload) => repositories.captures.insertRawPayload(payload),
          insert: (capture) => repositories.captures.insert(capture),
          getById: (id) => repositories.captures.getById(id),
          getWithRawPayload: (id) => repositories.captures.getWithRawPayload(id),
          applyProposalCas: async (...args) => {
            if (!injected) {
              injected = true;
              await pool.query(`UPDATE capture.capture_items SET revision=revision+1 WHERE id=$1`, [captured.command.payload.captureId]);
            }
            return repositories.captures.applyProposalCas(...args);
          },
        },
      } satisfies TransactionRepositories)),
    };
    const tasksBefore = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner.actorId],
    );
    await expect(new ProposalHandlers(racingUnitOfWork, runtime, new DeterministicStructuredProposalGenerator()).apply(command)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const tasksAfter = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner.actorId],
    );
    expect(tasksAfter.rows[0]?.count).toBe(tasksBefore.rows[0]?.count);
    const proposal = await pool.query(`SELECT status FROM ai.proposals WHERE id=$1`, [generated.proposalId]);
    expect(proposal.rows[0]?.status).toBe("ready");
  });

  it("serializes concurrent Apply so one succeeds and one loses without a second Task", async () => {
    const owner = await actor("apply-concurrent");
    const captured = await createCapture(owner, "apply-concurrent");
    const generated = await generateProposal(owner, captured.command.payload.captureId, "apply-concurrent");
    const first = applyCommand(owner, generated.proposalId, captured.command.payload.captureId, 1n, "stage5-apply-concurrent-a");
    const second = applyCommand(owner, generated.proposalId, captured.command.payload.captureId, 1n, "stage5-apply-concurrent-b");
    const settled = await Promise.allSettled([
      new ProposalHandlers(unitOfWork, runtime, new DeterministicStructuredProposalGenerator()).apply(first),
      new ProposalHandlers(unitOfWork, runtime, new DeterministicStructuredProposalGenerator()).apply(second),
    ]);
    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "REVISION_CONFLICT" });
    const state = await pool.query<{ tasks: number; revision: string; status: string }>(
      `SELECT
        (SELECT count(*)::int FROM core.objects WHERE id=ANY(c.materialized_object_ids)) tasks,
        c.revision::text revision, p.status
       FROM capture.capture_items c JOIN ai.proposals p ON p.id=$2 WHERE c.id=$1`,
      [captured.command.payload.captureId, generated.proposalId],
    );
    expect(state.rows[0]).toEqual({ tasks: 1, revision: "2", status: "applied" });
  });

  it("conceals a foreign Proposal and leaves all business state unchanged", async () => {
    const owner = await actor("foreign-owner");
    const foreign = await actor("foreign-attacker");
    const captured = await createCapture(owner, "foreign-owner");
    const generated = await generateProposal(owner, captured.command.payload.captureId, "foreign-owner");
    const command = applyCommand(foreign, generated.proposalId, captured.command.payload.captureId, 1n, "stage5-foreign-apply");
    const ownerTasksBefore = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner.actorId],
    );
    await expect(new ProposalHandlers(unitOfWork, runtime, new DeterministicStructuredProposalGenerator()).apply(command)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const proposal = await pool.query<{ status: string; changes: number; outbox: number; owner_tasks: number }>(
      `SELECT p.status,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$2) changes,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$2) outbox,
        (SELECT count(*)::int FROM core.objects WHERE owner_id=$3) owner_tasks
       FROM ai.proposals p WHERE p.id=$1`,
      [generated.proposalId, command.commandId, owner.actorId],
    );
    expect(proposal.rows[0]).toEqual({ status: "ready", changes: 0, outbox: 0, owner_tasks: ownerTasksBefore.rows[0]?.count });
  });
});
