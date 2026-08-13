import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { TextDecoder } from "node:util";

import pg from "pg";

const { Pool } = pg;
const webPort = 43117;
const baseUrl = `http://127.0.0.1:${webPort}`;

function uuidv7() {
  const bytes = randomBytes(16);
  const now = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) bytes[index] = Number((now >> BigInt((5 - index) * 8)) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const command = (extra = {}) => ({ commandId: uuidv7(), sourceContext: { route: "/stage3-test", surface: "http-integration" }, ...extra });

async function waitForServer(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next server exited early with ${child.exitCode}`);
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Next production server did not become ready");
}

async function withServer(profile, databaseUrl, operation) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: new URL("../../../apps/web/", import.meta.url),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      XIANGXU_RUNTIME_PROFILE: profile,
      XIANGXU_DEV_SESSION_ENABLED: "1",
      XIANGXU_SSE_POLL_MS: "25",
      XIANGXU_SSE_HEARTBEAT_MS: "50",
      XIANGXU_SSE_REPLAY_LIMIT: "2",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  try {
    await waitForServer(child);
    return await operation();
  } finally {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Set-Cookie must be present");
  assert.match(setCookie, /HttpOnly/iu);
  assert.match(setCookie, /SameSite=Lax/iu);
  assert.match(setCookie, /Path=\//iu);
  assert.match(setCookie, /Max-Age=/iu);
  return setCookie.split(";", 1)[0];
}

async function jsonRequest(path, { cookie, method = "GET", body, headers = {}, signal } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie === undefined ? {} : { cookie }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal === undefined ? {} : { signal }),
  });
}

async function readSseBlocks(response, count, controller, timeoutMilliseconds = 3_000, accept = () => true) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/event-stream/iu);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const blocks = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMilliseconds;
  try {
    while (blocks.length < count && Date.now() < deadline) {
      const read = await Promise.race([
        reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SSE read timed out")), Math.max(1, deadline - Date.now()))),
      ]);
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      while (buffer.includes("\n\n")) {
        const boundary = buffer.indexOf("\n\n");
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (block.length > 0 && accept(block)) blocks.push(block);
        if (blocks.length >= count) break;
      }
    }
    assert.equal(blocks.length, count, `Expected ${count} SSE blocks`);
    return blocks;
  } finally {
    controller.abort();
    await reader.cancel().catch(() => undefined);
  }
}

async function expectProblem(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /^application\/problem\+json/iu);
  assert.equal((await response.json()).code, code);
}

async function counts(pool) {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM core.objects) tasks,
    (SELECT count(*)::int FROM audit.change_records) changes,
    (SELECT count(*)::int FROM infra.outbox_events) outbox,
    (SELECT count(*)::int FROM infra.idempotency_keys) idempotency`);
  return result.rows[0];
}

async function timeBlockCounts(pool) {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM planning.time_blocks) blocks,
    (SELECT count(*)::int FROM audit.change_records WHERE target_type='time_block') changes,
    (SELECT count(*)::int FROM infra.outbox_events WHERE target_type='time_block') outbox,
    (SELECT count(*)::int FROM infra.idempotency_keys WHERE command_type IN ('timeblock.create','timeblock.move')) idempotency`);
  return result.rows[0];
}

async function dailyLoopCounts(pool, ownerId, date) {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM planning.plan_snapshots WHERE owner_id=$1 AND local_date=$2) plans,
    (SELECT count(*)::int FROM planning.review_snapshots WHERE owner_id=$1 AND local_date=$2) reviews,
    (SELECT count(*)::int FROM planning.execution_records WHERE owner_id=$1) executions`, [ownerId, date]);
  return result.rows[0];
}

async function createDirectSession(pool, subject, { expired = false } = {}) {
  const token = randomBytes(32).toString("base64url");
  const user = await pool.query(
    "INSERT INTO identity.users (dev_subject) VALUES ($1) ON CONFLICT (dev_subject) DO UPDATE SET dev_subject=EXCLUDED.dev_subject RETURNING id",
    [subject],
  );
  await pool.query(
    `INSERT INTO identity.device_sessions (user_id, token_hash, created_at, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [user.rows[0].id, hash(token), expired ? new Date(Date.now() - 7_200_000) : new Date(), expired ? new Date(Date.now() - 3_600_000) : new Date(Date.now() + 3_600_000)],
  );
  return { cookie: `xiangxu_dev_session=${token}`, userId: user.rows[0].id };
}

export async function runStage3HttpIntegration(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  try {
    await pool.query("TRUNCATE planning.review_snapshots, planning.execution_records, planning.plan_snapshot_items, planning.plan_snapshots, ai.proposal_targets, ai.proposals, capture.capture_items, capture.raw_payloads, planning.time_blocks, audit.change_records, infra.outbox_events, infra.idempotency_keys, core.task_details, core.objects, identity.device_sessions, identity.users RESTART IDENTITY CASCADE");

    await withServer("production", databaseUrl, async () => {
      await expectProblem(await jsonRequest("/api/dev/session", { method: "POST", body: {} }), 404, "NOT_FOUND");
    });

    await withServer("test", databaseUrl, async () => {
      await expectProblem(await jsonRequest(`/api/v1/tasks/${uuidv7()}`), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest("/api/v1/stream"), 401, "AUTH_REQUIRED");

      const sessionResponse = await jsonRequest("/api/dev/session", { method: "POST", body: {} });
      assert.equal(sessionResponse.status, 200);
      const cookieA = cookieFrom(sessionResponse);

      const malicious = command({ taskId: uuidv7(), title: "bad", commitmentState: "committed", ownerId: uuidv7() });
      const beforeMalicious = await counts(pool);
      await expectProblem(await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: malicious, headers: { "Idempotency-Key": "malicious-1" } }), 400, "VALIDATION_ERROR");
      assert.deepEqual(await counts(pool), beforeMalicious);

      const createBody = command({ taskId: uuidv7(), title: "Stage 3 Task", commitmentState: "committed" });
      await expectProblem(await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: createBody }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: createBody, headers: { "Idempotency-Key": "short" } }), 400, "VALIDATION_ERROR");

      const createHeaders = { "Idempotency-Key": "create-task-001" };
      const initialStreamController = new globalThis.AbortController();
      const initialStream = await jsonRequest("/api/v1/stream", { cookie: cookieA, signal: initialStreamController.signal });
      const created = await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: createBody, headers: createHeaders });
      assert.equal(created.status, 201);
      assert.equal(created.headers.get("etag"), '"rev-1"');
      assert.equal((await created.json()).revision, "1");
      const initialBlocks = await readSseBlocks(initialStream, 1, initialStreamController, 3_000, (block) => block.startsWith("id: "));
      assert.match(initialBlocks[0], /event: object\.changed/u);
      assert.match(initialBlocks[0], new RegExp(createBody.taskId, "u"));

      const replay = await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: createBody, headers: createHeaders });
      assert.equal(replay.status, 201);
      assert.equal(replay.headers.get("etag"), '"rev-1"');
      assert.deepEqual(await counts(pool), { tasks: 1, changes: 1, outbox: 1, idempotency: 1 });

      await expectProblem(await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: { ...createBody, title: "changed" }, headers: createHeaders }), 409, "IDEMPOTENCY_CONFLICT");
      assert.deepEqual(await counts(pool), { tasks: 1, changes: 1, outbox: 1, idempotency: 1 });

      const concurrentBody = command({ taskId: uuidv7(), title: "Concurrent", commitmentState: "someday" });
      const concurrentOptions = { method: "POST", cookie: cookieA, body: concurrentBody, headers: { "Idempotency-Key": "create-concurrent-001" } };
      const concurrent = await Promise.all([jsonRequest("/api/v1/tasks", concurrentOptions), jsonRequest("/api/v1/tasks", concurrentOptions)]);
      const concurrentStatuses = concurrent.map((response) => response.status).sort();
      assert.ok(concurrentStatuses.filter((status) => status === 201).length >= 1);
      assert.ok(concurrentStatuses.every((status) => status === 201 || status === 409));
      assert.deepEqual(await counts(pool), { tasks: 2, changes: 2, outbox: 2, idempotency: 2 });

      const read = await jsonRequest(`/api/v1/tasks/${createBody.taskId}`, { cookie: cookieA });
      assert.equal(read.status, 200);
      assert.equal(read.headers.get("etag"), '"rev-1"');
      const readBody = await read.json();
      assert.equal(readBody.revision, "1");
      const owner = readBody.ownerId;

      const sessionB = await createDirectSession(pool, "stage3-user-b");
      await expectProblem(await jsonRequest(`/api/v1/tasks/${createBody.taskId}`, { cookie: sessionB.cookie }), 404, "NOT_FOUND");
      const expired = await createDirectSession(pool, "stage3-expired", { expired: true });
      await expectProblem(await jsonRequest(`/api/v1/tasks/${createBody.taskId}`, { cookie: expired.cookie }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest("/api/v1/stream", { cookie: expired.cookie }), 401, "AUTH_REQUIRED");

      const heartbeatController = new globalThis.AbortController();
      const heartbeat = await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor },
        signal: heartbeatController.signal,
      });
      const heartbeatBlocks = await readSseBlocks(heartbeat, 1, heartbeatController, 3_000, (block) => block === ": heartbeat");
      assert.equal(heartbeatBlocks[0], ": heartbeat");

      const completeBody = command();
      const completePath = `/api/v1/tasks/${createBody.taskId}/complete`;
      await expectProblem(await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: completeBody, headers: { "Idempotency-Key": "complete-task-001" } }), 428, "PRECONDITION_REQUIRED");
      for (const malformed of ['W/"rev-1"', "*", "rev-1", '"rev-01"']) {
        await expectProblem(await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: completeBody, headers: { "Idempotency-Key": "complete-task-001", "If-Match": malformed } }), 400, "VALIDATION_ERROR");
      }
      await expectProblem(await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: completeBody, headers: { "Idempotency-Key": "stale-before", "If-Match": '"rev-2"' } }), 412, "PRECONDITION_FAILED");

      const completeHeaders = { "Idempotency-Key": "complete-task-001", "If-Match": '"rev-1"' };
      const completed = await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: completeBody, headers: completeHeaders });
      assert.equal(completed.status, 200);
      assert.equal(completed.headers.get("etag"), '"rev-2"');
      assert.equal((await completed.json()).revision, "2");

      const completeReplay = await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: completeBody, headers: completeHeaders });
      assert.equal(completeReplay.status, 200);
      assert.equal(completeReplay.headers.get("etag"), '"rev-2"');
      assert.equal((await completeReplay.json()).revision, "2");
      assert.deepEqual(await counts(pool), { tasks: 2, changes: 3, outbox: 3, idempotency: 3 });

      await expectProblem(await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: completeBody, headers: { "Idempotency-Key": "complete-task-001", "If-Match": '"rev-2"' } }), 409, "IDEMPOTENCY_CONFLICT");
      await expectProblem(await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: command(), headers: { "Idempotency-Key": "complete-again-001", "If-Match": '"rev-2"' } }), 409, "REVISION_CONFLICT");
      await expectProblem(await jsonRequest(completePath, { method: "POST", cookie: cookieA, body: command(), headers: { "Idempotency-Key": "complete-stale-001", "If-Match": '"rev-1"' } }), 412, "PRECONDITION_FAILED");
      await expectProblem(await jsonRequest(`/api/v1/tasks/${uuidv7()}`, { cookie: cookieA }), 404, "NOT_FOUND");
      assert.deepEqual(await counts(pool), { tasks: 2, changes: 3, outbox: 3, idempotency: 3 });

      const audit = await pool.query("SELECT o.owner_id, c.actor_id, c.base_revision::text, c.new_revision::text, c.source_context, e.revision::text, e.status FROM core.objects o JOIN audit.change_records c ON c.target_id=o.id JOIN infra.outbox_events e ON e.correlation_id=c.correlation_id WHERE o.id=$1 ORDER BY c.new_revision", [createBody.taskId]);
      assert.equal(audit.rowCount, 2);
      assert.ok(audit.rows.every((row) => row.owner_id === owner && row.actor_id === owner && row.status === "pending"));
      assert.deepEqual(audit.rows.map((row) => row.source_context), [
        { route: "/api/v1/tasks", surface: "dev-local" },
        { route: completePath, surface: "dev-local" },
      ]);
      assert.deepEqual(audit.rows.map((row) => [row.base_revision, row.new_revision, row.revision]), [["1", "1", "1"], ["1", "2", "2"]]);

      const timeBlockPath = "/api/v1/time-blocks";
      const taskForBlock = command({ taskId: uuidv7(), title: "Stage 4 Task", commitmentState: "committed", dueOn: "2026-09-01" });
      const foreignTask = command({ taskId: uuidv7(), title: "Foreign Stage 4 Task", commitmentState: "committed" });
      assert.equal((await jsonRequest("/api/v1/tasks", { method: "POST", cookie: cookieA, body: taskForBlock, headers: { "Idempotency-Key": "stage4-task-owner" } })).status, 201);
      assert.equal((await jsonRequest("/api/v1/tasks", { method: "POST", cookie: sessionB.cookie, body: foreignTask, headers: { "Idempotency-Key": "stage4-task-foreign" } })).status, 201);
      const taskBefore = await (await jsonRequest(`/api/v1/tasks/${taskForBlock.taskId}`, { cookie: cookieA })).json();

      const mainBlock = command({
        timeBlockId: uuidv7(), taskId: taskForBlock.taskId,
        startAt: "2026-09-02T01:00:00.000Z", endAt: "2026-09-02T02:00:00.000Z",
        timezone: "Asia/Shanghai", locked: true,
      });
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", body: mainBlock, headers: { "Idempotency-Key": "stage4-no-session" } }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: mainBlock }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: mainBlock, headers: { "Idempotency-Key": "short" } }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: { ...mainBlock, endAt: mainBlock.startAt }, headers: { "Idempotency-Key": "stage4-bad-interval" } }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: { ...mainBlock, timezone: "Mars/Olympus" }, headers: { "Idempotency-Key": "stage4-bad-timezone" } }), 400, "VALIDATION_ERROR");
      const foreignCreate = command({ ...mainBlock, timeBlockId: uuidv7(), taskId: foreignTask.taskId });
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: foreignCreate, headers: { "Idempotency-Key": "stage4-foreign-task" } }), 404, "NOT_FOUND");
      const unknownCreate = command({ ...mainBlock, timeBlockId: uuidv7(), taskId: uuidv7() });
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: unknownCreate, headers: { "Idempotency-Key": "stage4-unknown-task" } }), 404, "NOT_FOUND");
      assert.deepEqual(await timeBlockCounts(pool), { blocks: 0, changes: 0, outbox: 0, idempotency: 0 });

      const mainHeaders = { "Idempotency-Key": "stage4-create-main" };
      const mainCreated = await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: mainBlock, headers: mainHeaders });
      assert.equal(mainCreated.status, 201);
      assert.equal(mainCreated.headers.get("etag"), '"rev-1"');
      const mainCreatedBody = await mainCreated.json();
      assert.equal(mainCreatedBody.revision, "1");
      const mainReplay = await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: mainBlock, headers: mainHeaders });
      assert.equal(mainReplay.status, 201);
      assert.deepEqual(await mainReplay.json(), mainCreatedBody);
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: { ...mainBlock, endAt: "2026-09-02T02:30:00.000Z" }, headers: mainHeaders }), 409, "IDEMPOTENCY_CONFLICT");

      const adjacentBlock = command({
        timeBlockId: uuidv7(), taskId: taskForBlock.taskId,
        startAt: "2026-09-02T02:00:00.000Z", endAt: "2026-09-02T03:00:00.000Z",
        timezone: "Asia/Shanghai", locked: false,
      });
      assert.equal((await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: adjacentBlock, headers: { "Idempotency-Key": "stage4-create-adjacent" } })).status, 201);
      const overlapBlock = command({ ...adjacentBlock, timeBlockId: uuidv7(), startAt: "2026-09-02T01:30:00.000Z" });
      await expectProblem(await jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: overlapBlock, headers: { "Idempotency-Key": "stage4-create-overlap" } }), 409, "TIMEBLOCK_CONFLICT");

      const concurrentOne = command({
        timeBlockId: uuidv7(), taskId: taskForBlock.taskId,
        startAt: "2026-09-02T04:00:00.000Z", endAt: "2026-09-02T06:00:00.000Z",
        timezone: "Asia/Shanghai", locked: false,
      });
      const concurrentTwo = command({ ...concurrentOne, timeBlockId: uuidv7(), commandId: uuidv7(), startAt: "2026-09-02T05:00:00.000Z", endAt: "2026-09-02T07:00:00.000Z" });
      const concurrentOverlap = await Promise.all([
        jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: concurrentOne, headers: { "Idempotency-Key": "stage4-concurrent-one" } }),
        jsonRequest(timeBlockPath, { method: "POST", cookie: cookieA, body: concurrentTwo, headers: { "Idempotency-Key": "stage4-concurrent-two" } }),
      ]);
      assert.deepEqual(concurrentOverlap.map((response) => response.status).sort(), [201, 409]);

      const movePath = `${timeBlockPath}/${mainBlock.timeBlockId}`;
      const moveBody = command({ startAt: "2026-09-02T03:00:00.000Z", endAt: "2026-09-02T04:00:00.000Z", timezone: "Asia/Shanghai" });
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: sessionB.cookie, body: moveBody, headers: { "Idempotency-Key": "stage4-foreign-move", "If-Match": '"rev-1"' } }), 404, "NOT_FOUND");
      await expectProblem(await jsonRequest(`${timeBlockPath}/${uuidv7()}`, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "Idempotency-Key": "stage4-unknown-block", "If-Match": '"rev-1"' } }), 404, "NOT_FOUND");
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "Idempotency-Key": "stage4-missing-match" } }), 428, "PRECONDITION_REQUIRED");
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "If-Match": '"rev-1"' } }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "Idempotency-Key": "short", "If-Match": '"rev-1"' } }), 400, "VALIDATION_ERROR");
      for (const malformed of ['W/"rev-1"', "*", "rev-1", '"rev-01"']) {
        await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "Idempotency-Key": "stage4-malformed-match", "If-Match": malformed } }), 400, "VALIDATION_ERROR");
      }
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "Idempotency-Key": "stage4-stale-before", "If-Match": '"rev-2"' } }), 412, "PRECONDITION_FAILED");
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: { ...moveBody, endAt: moveBody.startAt }, headers: { "Idempotency-Key": "stage4-move-invalid", "If-Match": '"rev-1"' } }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: { ...moveBody, timezone: "Mars/Olympus" }, headers: { "Idempotency-Key": "stage4-move-timezone", "If-Match": '"rev-1"' } }), 400, "VALIDATION_ERROR");

      const moveHeaders = { "Idempotency-Key": "stage4-move-main", "If-Match": '"rev-1"' };
      const moved = await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: moveHeaders });
      assert.equal(moved.status, 200);
      assert.equal(moved.headers.get("etag"), '"rev-2"');
      const movedBody = await moved.json();
      assert.equal(movedBody.revision, "2");
      const movedReplay = await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: moveHeaders });
      assert.equal(movedReplay.status, 200);
      assert.deepEqual(await movedReplay.json(), movedBody);
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { ...moveHeaders, "If-Match": '"rev-2"' } }), 409, "IDEMPOTENCY_CONFLICT");
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveBody, headers: { "Idempotency-Key": "stage4-stale-after", "If-Match": '"rev-1"' } }), 412, "PRECONDITION_FAILED");
      const moveOverlap = command({ startAt: adjacentBlock.startAt, endAt: adjacentBlock.endAt, timezone: "Asia/Shanghai" });
      await expectProblem(await jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: moveOverlap, headers: { "Idempotency-Key": "stage4-move-overlap", "If-Match": '"rev-2"' } }), 409, "TIMEBLOCK_CONFLICT");

      const casOne = command({ startAt: "2026-09-03T01:00:00.000Z", endAt: "2026-09-03T02:00:00.000Z", timezone: "Asia/Shanghai" });
      const casTwo = command({ startAt: "2026-09-03T03:00:00.000Z", endAt: "2026-09-03T04:00:00.000Z", timezone: "Asia/Shanghai" });
      const concurrentCas = await Promise.all([
        jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: casOne, headers: { "Idempotency-Key": "stage4-cas-one", "If-Match": '"rev-2"' } }),
        jsonRequest(movePath, { method: "PATCH", cookie: cookieA, body: casTwo, headers: { "Idempotency-Key": "stage4-cas-two", "If-Match": '"rev-2"' } }),
      ]);
      assert.deepEqual(concurrentCas.map((response) => response.status).sort(), [200, 412]);

      const taskAfter = await (await jsonRequest(`/api/v1/tasks/${taskForBlock.taskId}`, { cookie: cookieA })).json();
      assert.equal(taskAfter.dueOn, taskBefore.dueOn);
      assert.equal(taskAfter.revision, taskBefore.revision);
      const blockState = await pool.query(
        `SELECT owner_id::text, task_id::text, locked, revision::text,
          (SELECT count(*)::int FROM planning.execution_records) execution_rows
         FROM planning.time_blocks WHERE id=$1`,
        [mainBlock.timeBlockId],
      );
      assert.equal(blockState.rows[0].owner_id, owner);
      assert.equal(blockState.rows[0].task_id, taskForBlock.taskId);
      assert.equal(blockState.rows[0].locked, true);
      assert.equal(blockState.rows[0].revision, "3");
      assert.equal(blockState.rows[0].execution_rows, 0);
      assert.deepEqual(await timeBlockCounts(pool), { blocks: 3, changes: 5, outbox: 5, idempotency: 5 });

      const capturePath = "/api/v1/captures";
      const captureStreamCursor = (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor;
      const captureBody = command({
        captureId: uuidv7(),
        rawPayload: { id: uuidv7(), kind: "text", text: "Prepare Stage 5 launch checklist" },
      });
      await expectProblem(await jsonRequest(capturePath, { method: "POST", body: captureBody, headers: { "Idempotency-Key": "stage5-no-session" } }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: captureBody }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: { ...captureBody, ownerId: uuidv7() }, headers: { "Idempotency-Key": "stage5-malicious-owner" } }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: captureBody, headers: { "Idempotency-Key": "short" } }), 400, "VALIDATION_ERROR");

      const captureHeaders = { "Idempotency-Key": "stage5-capture-main" };
      const captureCreated = await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: captureBody, headers: captureHeaders });
      assert.equal(captureCreated.status, 201);
      assert.equal(captureCreated.headers.get("etag"), '"rev-1"');
      const captureCreatedBody = await captureCreated.json();
      assert.equal(captureCreatedBody.revision, "1");
      const captureReplay = await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: captureBody, headers: captureHeaders });
      assert.equal(captureReplay.status, 201);
      assert.deepEqual(await captureReplay.json(), captureCreatedBody);
      await expectProblem(await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: { ...captureBody, rawPayload: { ...captureBody.rawPayload, text: "Changed text" } }, headers: captureHeaders }), 409, "IDEMPOTENCY_CONFLICT");

      const concurrentCapture = command({
        captureId: uuidv7(),
        rawPayload: { id: uuidv7(), kind: "text", text: "Concurrent Capture" },
      });
      const concurrentCaptureOptions = { method: "POST", cookie: cookieA, body: concurrentCapture, headers: { "Idempotency-Key": "stage5-capture-concurrent" } };
      const concurrentCaptureResponses = await Promise.all([
        jsonRequest(capturePath, concurrentCaptureOptions), jsonRequest(capturePath, concurrentCaptureOptions),
      ]);
      assert.ok(concurrentCaptureResponses.some(({ status }) => status === 201));
      assert.ok(concurrentCaptureResponses.every(({ status }) => status === 201 || status === 409));
      const captureRows = await pool.query(
        `SELECT c.owner_id::text, c.revision::text, c.triage_status, r.text_content, r.content_hash,
          (SELECT count(*)::int FROM audit.change_records WHERE target_id=c.id) changes,
          (SELECT count(*)::int FROM infra.outbox_events WHERE target_id=c.id AND status='pending') outbox
         FROM capture.capture_items c JOIN capture.raw_payloads r ON r.id=c.raw_payload_id WHERE c.id=$1`,
        [captureBody.captureId],
      );
      assert.equal(captureRows.rowCount, 1);
      assert.equal(captureRows.rows[0].owner_id, owner);
      assert.equal(captureRows.rows[0].revision, "1");
      assert.equal(captureRows.rows[0].triage_status, "untriaged");
      assert.equal(captureRows.rows[0].text_content, captureBody.rawPayload.text);
      assert.equal(captureRows.rows[0].content_hash, `sha256:${hash(captureBody.rawPayload.text)}`);
      assert.equal(captureRows.rows[0].changes, 1);
      assert.equal(captureRows.rows[0].outbox, 2);
      const captureOutbox = await pool.query(`SELECT payload::text FROM infra.outbox_events WHERE target_id=$1`, [captureBody.captureId]);
      assert.ok(captureOutbox.rows.every(({ payload }) => !payload.includes(captureBody.rawPayload.text)));
      assert.deepEqual((await pool.query(
        `SELECT topic FROM infra.outbox_events WHERE target_id=$1 ORDER BY sequence`,
        [captureBody.captureId],
      )).rows.map(({ topic }) => topic), ["object.changed", "capture.triage.requested"]);

      const captureStreamController = new globalThis.AbortController();
      const captureStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": captureStreamCursor },
        signal: captureStreamController.signal,
      });
      const captureStreamBlocks = await readSseBlocks(captureStream, 2, captureStreamController, 3_000, (block) => block.startsWith("id: "));
      assert.ok(captureStreamBlocks.every((block) => /event: object\.changed/u.test(block)));
      assert.ok(captureStreamBlocks.some((block) => block.includes(captureBody.captureId)));
      assert.ok(captureStreamBlocks.every((block) => !block.includes("capture.triage.requested")));
      assert.ok(captureStreamBlocks.every((block) => !block.includes(captureBody.rawPayload.text)));
      const captureEventId = /^id: ([1-9][0-9]*)$/mu.exec(captureStreamBlocks.at(-1))?.[1];
      assert.ok(captureEventId);

      const generatePath = `${capturePath}/${captureBody.captureId}/triage-proposals`;
      const generateBody = command();
      await expectProblem(await jsonRequest(generatePath, { method: "POST", body: generateBody, headers: { "Idempotency-Key": "stage5-generate-no-session" } }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest(generatePath, { method: "POST", cookie: cookieA, body: generateBody }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(generatePath, { method: "POST", cookie: cookieA, body: { ...generateBody, rawText: "forbidden" }, headers: { "Idempotency-Key": "stage5-generate-malicious" } }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(generatePath, { method: "POST", cookie: sessionB.cookie, body: generateBody, headers: { "Idempotency-Key": "stage5-generate-foreign" } }), 404, "NOT_FOUND");
      const ownerTasksBeforeReady = await pool.query(`SELECT count(*)::int count FROM core.objects WHERE owner_id=$1`, [owner]);
      const generateHeaders = { "Idempotency-Key": "stage5-generate-main" };
      const { ProposalGenerationProcessor } = await import(new URL("../../../apps/worker/dist/proposal-processor.js", import.meta.url));
      const triggerIntent = await pool.query(
        `SELECT id::text, sequence::text, command_id::text, correlation_id::text
         FROM infra.outbox_events
         WHERE target_id=$1 AND topic='capture.triage.requested'`,
        [captureBody.captureId],
      );
      const workerIntent = {
        outboxEventId: triggerIntent.rows[0].id,
        outboxSequence: triggerIntent.rows[0].sequence,
        captureId: captureBody.captureId,
        commandId: triggerIntent.rows[0].command_id,
        correlationId: triggerIntent.rows[0].correlation_id,
      };
      const generated = await new ProposalGenerationProcessor({
        generate: async (intent) => {
          assert.equal("rawText" in intent, false);
          return jsonRequest(`${capturePath}/${intent.captureId}/triage-proposals`, {
            method: "POST",
            cookie: cookieA,
            body: generateBody,
            headers: generateHeaders,
          });
        },
      }).process(workerIntent);
      assert.equal(generated.status, 202);
      assert.equal(generated.headers.get("etag"), null);
      const generatedBody = await generated.json();
      const proposalId = generatedBody.affectedRefs.find(({ objectType }) => objectType === "proposal")?.id;
      assert.ok(proposalId);
      const proposalStreamController = new globalThis.AbortController();
      const proposalStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": captureEventId },
        signal: proposalStreamController.signal,
      });
      const proposalStreamBlocks = await readSseBlocks(proposalStream, 1, proposalStreamController, 3_000, (block) => block.startsWith("id: "));
      assert.match(proposalStreamBlocks[0], /event: proposal\.ready/u);
      assert.match(proposalStreamBlocks[0], new RegExp(proposalId, "u"));
      assert.doesNotMatch(proposalStreamBlocks[0], /capture\.triage\.requested/u);
      const generatedReplay = await jsonRequest(generatePath, { method: "POST", cookie: cookieA, body: generateBody, headers: generateHeaders });
      assert.equal(generatedReplay.status, 202);
      assert.deepEqual(await generatedReplay.json(), generatedBody);
      await expectProblem(await jsonRequest(generatePath, { method: "POST", cookie: cookieA, body: { ...generateBody, sourceContext: { route: "/changed" } }, headers: generateHeaders }), 409, "IDEMPOTENCY_CONFLICT");
      const readyState = await pool.query(
        `SELECT p.status, p.proposal_type, p.created_by_type, p.structured_patch,
                t.target_type, t.target_id::text, t.base_revision::text,
                c.revision::text capture_revision, c.triage_status, r.text_content,
                (SELECT count(*)::int FROM core.objects WHERE owner_id=c.owner_id) owner_tasks
           FROM ai.proposals p JOIN ai.proposal_targets t ON t.proposal_id=p.id
           JOIN capture.capture_items c ON c.id=t.target_id
           JOIN capture.raw_payloads r ON r.id=c.raw_payload_id
          WHERE p.id=$1`,
        [proposalId],
      );
      assert.equal(readyState.rows[0].status, "ready");
      assert.equal(readyState.rows[0].proposal_type, "create");
      assert.equal(readyState.rows[0].created_by_type, "system");
      assert.equal(readyState.rows[0].structured_patch.kind, "task.create");
      assert.equal(readyState.rows[0].target_type, "capture_item");
      assert.equal(readyState.rows[0].target_id, captureBody.captureId);
      assert.equal(readyState.rows[0].base_revision, "1");
      assert.equal(readyState.rows[0].capture_revision, "1");
      assert.equal(readyState.rows[0].triage_status, "untriaged");
      assert.equal(readyState.rows[0].text_content, captureBody.rawPayload.text);
      assert.equal(readyState.rows[0].owner_tasks, ownerTasksBeforeReady.rows[0].count);

      const applyPath = `/api/v1/proposals/${proposalId}/apply`;
      const applyBody = command({ targets: [{ targetRef: { objectType: "capture_item", id: captureBody.captureId }, baseRevision: "1" }] });
      await expectProblem(await jsonRequest(applyPath, { method: "POST", body: applyBody, headers: { "Idempotency-Key": "stage5-apply-no-session" } }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest(applyPath, { method: "POST", cookie: cookieA, body: applyBody }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(applyPath, { method: "POST", cookie: sessionB.cookie, body: applyBody, headers: { "Idempotency-Key": "stage5-apply-foreign" } }), 404, "NOT_FOUND");
      await expectProblem(await jsonRequest(`/api/v1/proposals/${uuidv7()}/apply`, { method: "POST", cookie: cookieA, body: applyBody, headers: { "Idempotency-Key": "stage5-apply-unknown" } }), 404, "NOT_FOUND");
      const applyHeaders = { "Idempotency-Key": "stage5-apply-main" };
      const applied = await jsonRequest(applyPath, { method: "POST", cookie: cookieA, body: applyBody, headers: applyHeaders });
      assert.equal(applied.status, 200);
      assert.equal(applied.headers.get("etag"), null);
      const appliedBody = await applied.json();
      const materializedTaskId = appliedBody.affectedRefs.find(({ objectType }) => objectType === "task")?.id;
      assert.ok(materializedTaskId);
      const appliedReplay = await jsonRequest(applyPath, { method: "POST", cookie: cookieA, body: applyBody, headers: applyHeaders });
      assert.equal(appliedReplay.status, 200);
      assert.deepEqual(await appliedReplay.json(), appliedBody);
      await expectProblem(await jsonRequest(applyPath, { method: "POST", cookie: cookieA, body: { ...applyBody, targets: [{ ...applyBody.targets[0], baseRevision: "2" }] }, headers: applyHeaders }), 409, "IDEMPOTENCY_CONFLICT");
      const appliedState = await pool.query(
        `SELECT p.status, p.created_by_type, c.revision::text capture_revision, c.triage_status,
                c.proposal_id::text, c.materialized_object_ids::text[], o.revision::text task_revision,
                o.title, o.owner_id::text, r.text_content
           FROM ai.proposals p JOIN capture.capture_items c ON c.id=$2
           JOIN capture.raw_payloads r ON r.id=c.raw_payload_id
           JOIN core.objects o ON o.id=$3 WHERE p.id=$1`,
        [proposalId, captureBody.captureId, materializedTaskId],
      );
      assert.deepEqual(appliedState.rows[0], {
        status: "applied",
        created_by_type: "system",
        capture_revision: "2",
        triage_status: "accepted",
        proposal_id: proposalId,
        materialized_object_ids: [materializedTaskId],
        task_revision: "1",
        title: captureBody.rawPayload.text,
        owner_id: owner,
        text_content: captureBody.rawPayload.text,
      });

      const staleCapture = command({ captureId: uuidv7(), rawPayload: { id: uuidv7(), kind: "text", text: "Stale Capture" } });
      assert.equal((await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: staleCapture, headers: { "Idempotency-Key": "stage5-stale-capture" } })).status, 201);
      const staleGeneratePath = `${capturePath}/${staleCapture.captureId}/triage-proposals`;
      const staleGenerated = await jsonRequest(staleGeneratePath, { method: "POST", cookie: cookieA, body: command(), headers: { "Idempotency-Key": "stage5-stale-generate" } });
      const staleProposalId = (await staleGenerated.json()).affectedRefs.find(({ objectType }) => objectType === "proposal")?.id;
      await pool.query(`UPDATE capture.capture_items SET revision=revision+1 WHERE id=$1`, [staleCapture.captureId]);
      const staleApplyBody = command({ targets: [{ targetRef: { objectType: "capture_item", id: staleCapture.captureId }, baseRevision: "1" }] });
      await expectProblem(await jsonRequest(`/api/v1/proposals/${staleProposalId}/apply`, { method: "POST", cookie: cookieA, body: staleApplyBody, headers: { "Idempotency-Key": "stage5-stale-apply" } }), 409, "PROPOSAL_STALE");
      const staleState = await pool.query(
        `SELECT p.status,
          (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$2) changes,
          (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$2) outbox,
          (SELECT count(*)::int FROM infra.idempotency_keys WHERE idempotency_key='stage5-stale-apply') keys
         FROM ai.proposals p WHERE p.id=$1`,
        [staleProposalId, staleApplyBody.commandId],
      );
      assert.deepEqual(staleState.rows[0], { status: "ready", changes: 0, outbox: 0, keys: 0 });

      const raceCapture = command({ captureId: uuidv7(), rawPayload: { id: uuidv7(), kind: "text", text: "Concurrent Apply" } });
      assert.equal((await jsonRequest(capturePath, { method: "POST", cookie: cookieA, body: raceCapture, headers: { "Idempotency-Key": "stage5-race-capture" } })).status, 201);
      const raceGeneratePath = `${capturePath}/${raceCapture.captureId}/triage-proposals`;
      const raceGenerated = await jsonRequest(raceGeneratePath, { method: "POST", cookie: cookieA, body: command(), headers: { "Idempotency-Key": "stage5-race-generate" } });
      const raceProposalId = (await raceGenerated.json()).affectedRefs.find(({ objectType }) => objectType === "proposal")?.id;
      const raceApplyPath = `/api/v1/proposals/${raceProposalId}/apply`;
      const raceApplyBodyA = command({ targets: [{ targetRef: { objectType: "capture_item", id: raceCapture.captureId }, baseRevision: "1" }] });
      const raceApplyBodyB = command({ targets: raceApplyBodyA.targets });
      const raceResponses = await Promise.all([
        jsonRequest(raceApplyPath, { method: "POST", cookie: cookieA, body: raceApplyBodyA, headers: { "Idempotency-Key": "stage5-race-apply-a" } }),
        jsonRequest(raceApplyPath, { method: "POST", cookie: cookieA, body: raceApplyBodyB, headers: { "Idempotency-Key": "stage5-race-apply-b" } }),
      ]);
      assert.deepEqual(raceResponses.map(({ status }) => status).sort(), [200, 409]);
      const raceState = await pool.query(
        `SELECT p.status, c.revision::text,
          (SELECT count(*)::int FROM core.objects WHERE id=ANY(c.materialized_object_ids)) tasks
         FROM ai.proposals p JOIN capture.capture_items c ON c.id=$2 WHERE p.id=$1`,
        [raceProposalId, raceCapture.captureId],
      );
      assert.deepEqual(raceState.rows[0], { status: "applied", revision: "2", tasks: 1 });

      const isolationCursor = (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor;
      const foreignCapture = command({ captureId: uuidv7(), rawPayload: { id: uuidv7(), kind: "text", text: "Foreign SSE Capture" } });
      assert.equal((await jsonRequest(capturePath, {
        method: "POST", cookie: sessionB.cookie, body: foreignCapture,
        headers: { "Idempotency-Key": "stage6-sse-foreign-capture" },
      })).status, 201);
      const isolatedController = new globalThis.AbortController();
      const isolatedStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": isolationCursor },
        signal: isolatedController.signal,
      });
      assert.equal((await readSseBlocks(isolatedStream, 1, isolatedController, 3_000, (block) => block === ": heartbeat"))[0], ": heartbeat");

      const bigintController = new globalThis.AbortController();
      const bigintStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": "9007199254740993" },
        signal: bigintController.signal,
      });
      assert.equal((await readSseBlocks(bigintStream, 1, bigintController, 3_000, (block) => block === ": heartbeat"))[0], ": heartbeat");
      await expectProblem(await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": "not-a-sequence" },
      }), 400, "VALIDATION_ERROR");

      const resyncCursor = (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor;
      for (const [index, key] of ["one", "two", "three"].entries()) {
        const body = command({ taskId: uuidv7(), title: `Stage 6 resync ${index}`, commitmentState: "someday" });
        assert.equal((await jsonRequest("/api/v1/tasks", {
          method: "POST", cookie: cookieA, body,
          headers: { "Idempotency-Key": `stage6-resync-${key}` },
        })).status, 201);
      }
      const resyncController = new globalThis.AbortController();
      const resyncStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA,
        headers: { "Last-Event-ID": resyncCursor },
        signal: resyncController.signal,
      });
      const resyncBlocks = await readSseBlocks(resyncStream, 1, resyncController, 3_000, (block) => block.startsWith("id: "));
      assert.match(resyncBlocks[0], /event: system\.resync-required/u);
      assert.doesNotMatch(resyncBlocks[0], /Foreign SSE Capture|capture\.triage\.requested/u);

      const dailyDate = "2026-09-03";
      const dailyTimezone = "Asia/Shanghai";
      const planTaskOne = command({ taskId: uuidv7(), title: "Stage 7 Top One", commitmentState: "committed" });
      const planTaskTwo = command({ taskId: uuidv7(), title: "Stage 7 Top Two", commitmentState: "committed" });
      assert.equal((await jsonRequest("/api/v1/tasks", {
        method: "POST", cookie: cookieA, body: planTaskOne,
        headers: { "Idempotency-Key": "stage7-plan-task-one" },
      })).status, 201);
      assert.equal((await jsonRequest("/api/v1/tasks", {
        method: "POST", cookie: cookieA, body: planTaskTwo,
        headers: { "Idempotency-Key": "stage7-plan-task-two" },
      })).status, 201);

      const planPath = "/api/v1/plans/commit";
      const firstPlanBody = command({
        planSnapshotId: uuidv7(), date: dailyDate, timezone: dailyTimezone,
        capacityMinutes: 180, taskIds: [planTaskOne.taskId, planTaskTwo.taskId], timeBlockIds: [],
      });
      await expectProblem(await jsonRequest(planPath, { method: "POST", body: firstPlanBody, headers: { "Idempotency-Key": "stage7-plan-no-session" } }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest(planPath, { method: "POST", cookie: cookieA, body: firstPlanBody }), 400, "VALIDATION_ERROR");
      await expectProblem(await jsonRequest(planPath, {
        method: "POST", cookie: sessionB.cookie, body: firstPlanBody,
        headers: { "Idempotency-Key": "stage7-plan-foreign-task" },
      }), 404, "NOT_FOUND");
      assert.deepEqual(await dailyLoopCounts(pool, owner, dailyDate), { plans: 0, reviews: 0, executions: 0 });

      const planCursor = (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor;
      const planStreamController = new globalThis.AbortController();
      const planStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA, headers: { "Last-Event-ID": planCursor }, signal: planStreamController.signal,
      });
      const firstPlanHeaders = { "Idempotency-Key": "stage7-plan-first" };
      const firstPlan = await jsonRequest(planPath, { method: "POST", cookie: cookieA, body: firstPlanBody, headers: firstPlanHeaders });
      assert.equal(firstPlan.status, 201);
      const firstPlanReceipt = await firstPlan.json();
      assert.equal(firstPlanReceipt.revision, "1");
      assert.ok(firstPlanReceipt.affectedRefs.some(({ objectType, id }) => objectType === "plan_snapshot" && id === firstPlanBody.planSnapshotId));
      const planBlocks = await readSseBlocks(planStream, 1, planStreamController, 3_000, (block) => block.startsWith("id: "));
      assert.match(planBlocks[0], /event: object\.changed/u);
      assert.match(planBlocks[0], new RegExp(firstPlanBody.planSnapshotId, "u"));
      assert.match(planBlocks[0], /"today"/u);
      assert.match(planBlocks[0], /"review"/u);

      const firstPlanReplay = await jsonRequest(planPath, { method: "POST", cookie: cookieA, body: firstPlanBody, headers: firstPlanHeaders });
      assert.equal(firstPlanReplay.status, 201);
      assert.deepEqual(await firstPlanReplay.json(), firstPlanReceipt);
      await expectProblem(await jsonRequest(planPath, {
        method: "POST", cookie: cookieA, body: { ...firstPlanBody, capacityMinutes: 181 }, headers: firstPlanHeaders,
      }), 409, "IDEMPOTENCY_CONFLICT");

      const todayPath = `/api/v1/today?date=${dailyDate}&timezone=${encodeURIComponent(dailyTimezone)}`;
      const firstToday = await jsonRequest(todayPath, { cookie: cookieA });
      assert.equal(firstToday.status, 200);
      const firstTodayBody = await firstToday.json();
      assert.equal(firstTodayBody.id, firstPlanBody.planSnapshotId);
      assert.equal(firstTodayBody.version, 1);
      assert.deepEqual(firstTodayBody.items.map(({ taskId, order }) => ({ taskId, order })), [
        { taskId: planTaskOne.taskId, order: 1 },
        { taskId: planTaskTwo.taskId, order: 2 },
      ]);
      await expectProblem(await jsonRequest(todayPath, { cookie: sessionB.cookie }), 404, "NOT_FOUND");

      const secondPlanBody = command({
        planSnapshotId: uuidv7(), date: dailyDate, timezone: dailyTimezone,
        capacityMinutes: 120, taskIds: [planTaskTwo.taskId, planTaskOne.taskId], timeBlockIds: [],
      });
      const secondPlan = await jsonRequest(planPath, {
        method: "POST", cookie: cookieA, body: secondPlanBody,
        headers: { "Idempotency-Key": "stage7-plan-final" },
      });
      assert.equal(secondPlan.status, 201);
      assert.equal((await secondPlan.json()).revision, "2");
      const latestTodayBody = await (await jsonRequest(todayPath, { cookie: cookieA })).json();
      assert.equal(latestTodayBody.id, secondPlanBody.planSnapshotId);
      assert.equal(latestTodayBody.version, 2);
      assert.deepEqual((await dailyLoopCounts(pool, owner, dailyDate)), { plans: 2, reviews: 0, executions: 0 });

      const executionsBeforeComplete = (await dailyLoopCounts(pool, owner, dailyDate)).executions;
      const stage7Complete = await jsonRequest(`/api/v1/tasks/${planTaskOne.taskId}/complete`, {
        method: "POST", cookie: cookieA, body: command(),
        headers: { "Idempotency-Key": "stage7-complete-without-timing", "If-Match": '"rev-1"' },
      });
      assert.equal(stage7Complete.status, 200);
      assert.equal((await dailyLoopCounts(pool, owner, dailyDate)).executions, executionsBeforeComplete);

      const reviewPath = "/api/v1/reviews";
      const reviewBody = command({
        reviewSnapshotId: uuidv7(), date: dailyDate, timezone: dailyTimezone,
        baselinePlanSnapshotId: firstPlanBody.planSnapshotId,
        finalPlanSnapshotId: secondPlanBody.planSnapshotId,
        executionRecordIds: [],
      });
      await expectProblem(await jsonRequest(reviewPath, { method: "POST", body: reviewBody, headers: { "Idempotency-Key": "stage7-review-no-session" } }), 401, "AUTH_REQUIRED");
      await expectProblem(await jsonRequest(reviewPath, {
        method: "POST", cookie: sessionB.cookie, body: reviewBody,
        headers: { "Idempotency-Key": "stage7-review-foreign-plan" },
      }), 404, "NOT_FOUND");

      const reviewCursor = (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor;
      const reviewStreamController = new globalThis.AbortController();
      const reviewStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA, headers: { "Last-Event-ID": reviewCursor }, signal: reviewStreamController.signal,
      });
      const reviewHeaders = { "Idempotency-Key": "stage7-review-first" };
      const review = await jsonRequest(reviewPath, { method: "POST", cookie: cookieA, body: reviewBody, headers: reviewHeaders });
      assert.equal(review.status, 201);
      const reviewReceipt = await review.json();
      assert.equal(reviewReceipt.revision, "1");
      const reviewBlocks = await readSseBlocks(reviewStream, 1, reviewStreamController, 3_000, (block) => block.startsWith("id: "));
      assert.match(reviewBlocks[0], /event: object\.changed/u);
      assert.match(reviewBlocks[0], new RegExp(reviewBody.reviewSnapshotId, "u"));
      assert.match(reviewBlocks[0], /"review"/u);

      const reviewReplay = await jsonRequest(reviewPath, { method: "POST", cookie: cookieA, body: reviewBody, headers: reviewHeaders });
      assert.equal(reviewReplay.status, 201);
      assert.deepEqual(await reviewReplay.json(), reviewReceipt);
      await expectProblem(await jsonRequest(reviewPath, {
        method: "POST", cookie: cookieA, body: { ...reviewBody, reviewSnapshotId: uuidv7() }, headers: reviewHeaders,
      }), 409, "IDEMPOTENCY_CONFLICT");

      const reviewReadPath = `/api/v1/reviews/${dailyDate}?timezone=${encodeURIComponent(dailyTimezone)}`;
      const reviewRead = await jsonRequest(reviewReadPath, { cookie: cookieA });
      assert.equal(reviewRead.status, 200);
      const reviewReadBody = await reviewRead.json();
      assert.equal(reviewReadBody.id, reviewBody.reviewSnapshotId);
      assert.equal(reviewReadBody.baselinePlanSnapshotId, firstPlanBody.planSnapshotId);
      assert.equal(reviewReadBody.finalPlanSnapshotId, secondPlanBody.planSnapshotId);
      assert.deepEqual(reviewReadBody.executionRecordIds, []);
      assert.deepEqual(reviewReadBody.derivedMetrics, { plannedCount: 2, actualExecutionCount: 0, actualDurationMinutes: 0 });
      assert.deepEqual(reviewReadBody.aiInsightRefs, []);
      assert.ok(reviewReadBody.whatChanged.some(({ objectType, id }) => objectType === "plan_snapshot" && id === secondPlanBody.planSnapshotId));
      await expectProblem(await jsonRequest(reviewReadPath, { cookie: sessionB.cookie }), 404, "NOT_FOUND");
      assert.deepEqual(await dailyLoopCounts(pool, owner, dailyDate), { plans: 2, reviews: 1, executions: 0 });

      const concurrentDate = "2026-09-04";
      const concurrentPlans = ["a", "b"].map((label) => ({
        body: command({
          planSnapshotId: uuidv7(), date: concurrentDate, timezone: dailyTimezone,
          capacityMinutes: 60, taskIds: [planTaskTwo.taskId], timeBlockIds: [],
        }),
        headers: { "Idempotency-Key": `stage7-plan-concurrent-${label}` },
      }));
      const concurrentPlanResponses = await Promise.all(concurrentPlans.map(({ body, headers }) =>
        jsonRequest(planPath, { method: "POST", cookie: cookieA, body, headers })));
      assert.deepEqual(concurrentPlanResponses.map(({ status }) => status).sort(), [201, 201]);
      const concurrentVersions = await pool.query(
        "SELECT version::int FROM planning.plan_snapshots WHERE owner_id=$1 AND local_date=$2 ORDER BY version",
        [owner, concurrentDate],
      );
      assert.deepEqual(concurrentVersions.rows.map(({ version }) => version), [1, 2]);

      const foreignIsolationCursor = (await pool.query("SELECT max(sequence)::text cursor FROM infra.outbox_events")).rows[0].cursor;
      const foreignPlanBody = command({
        planSnapshotId: uuidv7(), date: dailyDate, timezone: dailyTimezone,
        capacityMinutes: 60, taskIds: [foreignTask.taskId], timeBlockIds: [],
      });
      assert.equal((await jsonRequest(planPath, {
        method: "POST", cookie: sessionB.cookie, body: foreignPlanBody,
        headers: { "Idempotency-Key": "stage7-foreign-plan-sse" },
      })).status, 201);
      const foreignPlanIsolationController = new globalThis.AbortController();
      const foreignPlanIsolationStream = await jsonRequest("/api/v1/stream", {
        cookie: cookieA, headers: { "Last-Event-ID": foreignIsolationCursor }, signal: foreignPlanIsolationController.signal,
      });
      assert.equal((await readSseBlocks(
        foreignPlanIsolationStream, 1, foreignPlanIsolationController, 3_000, (block) => block === ": heartbeat",
      ))[0], ": heartbeat");

      const deleted = await jsonRequest("/api/dev/session", { method: "DELETE", cookie: cookieA });
      assert.equal(deleted.status, 204);
      assert.match(deleted.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
      const revoked = await pool.query("SELECT count(*)::int count FROM identity.device_sessions WHERE revoked_at IS NOT NULL");
      assert.equal(revoked.rows[0].count, 1);
      await expectProblem(await jsonRequest(`/api/v1/tasks/${createBody.taskId}`, { cookie: cookieA }), 401, "AUTH_REQUIRED");
    });

    console.log("Stage 3 through Stage 7 production-build HTTP integration PASS — Task/TimeBlock/Capture/Proposal plus immutable Plan/Today/Review, zero-fabricated actuals, idempotency, concurrency, actor-isolated PostgreSQL SSE, resync and heartbeat verified.");
  } finally {
    await pool.end();
  }
}
