import { createHash, randomBytes } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const infrastructureRequire = createRequire(path.join(repositoryRoot, "packages/infrastructure/package.json"));
const { Pool } = infrastructureRequire("pg");

export const baseURL = `http://127.0.0.1:${process.env.XIANGXU_STAGE8_HTTP_PORT ?? "43117"}`;
export const frozenNow = "2026-08-13T03:00:00.000Z";
export const frozenDate = "2026-08-13";
export const frozenTimezone = "Asia/Shanghai";

export const ids = Object.freeze({
  actorA: "01989abc-0000-7000-8000-0000000000a1",
  actorB: "01989abc-0000-7000-8000-0000000000b1",
  functionalTask: "01989abc-0001-7000-8000-000000000101",
  functionalBlock: "01989abc-0001-7000-8000-000000000102",
  visualTaskOne: "01989abc-0002-7000-8000-000000000201",
  visualTaskTwo: "01989abc-0002-7000-8000-000000000202",
  visualBlock: "01989abc-0002-7000-8000-000000000203",
  visualPlan: "01989abc-0002-7000-8000-000000000204",
  visualReview: "01989abc-0002-7000-8000-000000000205",
});

export async function newStageContext(browser, options = {}) {
  const context = await browser.newContext({
    baseURL,
    locale: "zh-CN",
    timezoneId: frozenTimezone,
    viewport: options.viewport ?? { width: 1280, height: 800 },
    colorScheme: options.colorScheme ?? "light",
    reducedMotion: options.reducedMotion ?? "no-preference",
    serviceWorkers: "block",
  });
  await installDeterministicBrowserSeams(context);
  return context;
}

export async function installDeterministicBrowserSeams(context) {
  await context.addInitScript(({ timestamp }) => {
    const OriginalDate = Date;
    class FrozenDate extends OriginalDate {
      constructor(...args) {
        super(args.length === 0 ? timestamp : args[0]);
      }

      static now() {
        return timestamp;
      }
    }
    Object.setPrototypeOf(FrozenDate, OriginalDate);
    globalThis.Date = FrozenDate;

    const NativeEventSource = globalThis.EventSource;
    globalThis.__XIANGXU_STAGE8_SSE__ = [];
    globalThis.EventSource = class ObservedEventSource extends NativeEventSource {
      constructor(url, eventSourceInitDict) {
        super(url, eventSourceInitDict);
        for (const type of ["object.changed", "proposal.ready", "system.resync-required"]) {
          this.addEventListener(type, (event) => {
            globalThis.__XIANGXU_STAGE8_SSE__.push({
              type,
              id: event.lastEventId,
              data: event.data,
            });
          });
        }
      }
    };
  }, { timestamp: Date.parse(frozenNow) });
}

export async function createDirectSession(context, subject) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  await withPool(async (pool) => {
    const user = await pool.query(
      `INSERT INTO identity.users (dev_subject)
       VALUES ($1)
       ON CONFLICT (dev_subject) DO UPDATE SET dev_subject=EXCLUDED.dev_subject
       RETURNING id::text`,
      [subject],
    );
    await pool.query(
      `INSERT INTO identity.device_sessions (user_id, token_hash, created_at, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [user.rows[0].id, tokenHash, now, expiresAt],
    );
  });
  await context.addCookies([{
    name: "xiangxu_dev_session",
    value: token,
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax",
    expires: expiresAt.getTime() / 1000,
  }]);
  return { token, tokenHash, userId: undefined };
}

export async function revokeSession(tokenHash) {
  await withPool((pool) => pool.query(
    "UPDATE identity.device_sessions SET revoked_at=$2 WHERE token_hash=$1",
    [tokenHash, new Date(frozenNow)],
  ));
}

export async function nodeRequest(session, pathname, options = {}) {
  return globalThis.fetch(`${baseURL}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      cookie: `xiangxu_dev_session=${session.token}`,
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

export async function createTask(session, { id, title, key }) {
  const response = await nodeRequest(session, "/api/v1/tasks", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: command(uuidv7(), {
      taskId: id,
      title,
      commitmentState: "committed",
    }),
  });
  assertStatus(response, 201, `create Task ${title}`);
  return response.json();
}

export async function createTimeBlock(session, { id, taskId, key }) {
  const response = await nodeRequest(session, "/api/v1/time-blocks", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: command(uuidv7(), {
      timeBlockId: id,
      taskId,
      startAt: "2026-08-13T01:00:00.000Z",
      endAt: "2026-08-13T02:00:00.000Z",
      timezone: frozenTimezone,
      locked: false,
    }),
  });
  assertStatus(response, 201, "create TimeBlock");
  return response.json();
}

export async function commitPlan(session, { id, taskIds, timeBlockIds = [], key }) {
  const response = await nodeRequest(session, "/api/v1/plans/commit", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: command(uuidv7(), {
      planSnapshotId: id,
      date: frozenDate,
      timezone: frozenTimezone,
      capacityMinutes: 180,
      taskIds,
      timeBlockIds,
    }),
  });
  assertStatus(response, 201, "commit Plan");
  return response.json();
}

export async function createReview(session, { id, planId, key }) {
  const response = await nodeRequest(session, "/api/v1/reviews", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: command(uuidv7(), {
      reviewSnapshotId: id,
      date: frozenDate,
      timezone: frozenTimezone,
      baselinePlanSnapshotId: planId,
      finalPlanSnapshotId: planId,
      executionRecordIds: [],
    }),
  });
  assertStatus(response, 201, "create Review");
  return response.json();
}

export async function databaseCaptureProof(record) {
  const payload = record.command.payload;
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM capture.capture_items WHERE id=$1) captures,
        (SELECT count(*)::int FROM capture.raw_payloads WHERE id=$2) raw_payloads,
        (SELECT count(*)::int FROM audit.change_records WHERE correlation_id=$3) change_records,
        (SELECT count(*)::int FROM infra.outbox_events WHERE correlation_id=$3) outbox_rows,
        (SELECT count(*)::int FROM infra.idempotency_keys WHERE idempotency_key=$4) idempotency_rows`,
      [payload.captureId, payload.rawPayload.id, payload.commandId, record.command.idempotencyKey],
    );
    return result.rows[0];
  });
}

export async function countCapture(captureId) {
  return withPool(async (pool) => {
    const result = await pool.query("SELECT count(*)::int count FROM capture.capture_items WHERE id=$1", [captureId]);
    return result.rows[0].count;
  });
}

export async function readOfflineRecords(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open("xiangxu-offline-v1", 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("capture-commands")) request.result.createObjectStore("capture-commands");
      };
      request.onsuccess = () => resolve(request.result);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("capture-commands", "readonly");
        const request = transaction.objectStore("capture-commands").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

export function observePage(page, options = {}) {
  const errors = [];
  const failedRequests = [];
  const streamRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !(options.allowedConsole ?? []).some((pattern) => pattern.test(message.text()))) {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (new globalThis.URL(request.url()).pathname === "/api/v1/stream") {
      void request.allHeaders().then((headers) => {
        streamRequests.push(headers["last-event-id"] ?? "");
      }).catch(() => undefined);
    }
  });
  page.on("requestfailed", (request) => {
    const url = new globalThis.URL(request.url());
    if (url.origin !== baseURL) return;
    const requestIdentity = `${request.method()} ${url.pathname}`;
    if ((options.allowedFailures ?? []).some((pattern) => pattern.test(requestIdentity) || pattern.test(url.pathname))) return;
    failedRequests.push(`${requestIdentity}: ${request.failure()?.errorText ?? "failed"}`);
  });
  return {
    errors,
    failedRequests,
    streamRequests,
    assertClean(expect) {
      expect(errors, "unexpected console/page errors").toEqual([]);
      expect(failedRequests, "unexpected same-origin network failures").toEqual([]);
    },
  };
}

export async function sseEvents(page) {
  return page.evaluate(() => globalThis.__XIANGXU_STAGE8_SSE__ ?? []);
}

export async function restartNextProductionServer() {
  const signal = process.env.XIANGXU_STAGE8_NEXT_RESTART_SIGNAL;
  const ready = process.env.XIANGXU_STAGE8_NEXT_RESTART_READY;
  if (signal === undefined || ready === undefined) throw new Error("Stage 8 Next restart control is unavailable");
  await writeFile(signal, "restart\n", "utf8");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      await access(ready);
      return;
    } catch {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
    }
  }
  throw new Error("Next production server did not restart within 20 seconds");
}

export async function assertNoSecretSurface(page, expect) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/(?:DATABASE_URL|REDIS_URL|postgresql:\/\/|redis:\/\/|xiangxu_dev_session=)/u);
  expect(await page.evaluate(() => globalThis.document.cookie)).not.toContain("xiangxu_dev_session");
}

export async function withPool(operation) {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for Stage 8 test fixtures");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}

export function uuidv7() {
  const bytes = randomBytes(16);
  const milliseconds = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number((milliseconds >> BigInt((5 - index) * 8)) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function command(commandId, extra) {
  return {
    commandId,
    sourceContext: { route: "/stage8-fixture", surface: "browser-test-setup" },
    ...extra,
  };
}

function assertStatus(response, expected, operation) {
  if (response.status !== expected) {
    throw new Error(`${operation} expected ${expected}, received ${response.status}`);
  }
}
