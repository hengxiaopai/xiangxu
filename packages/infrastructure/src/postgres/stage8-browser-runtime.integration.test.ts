import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

import {
  DeterministicStructuredProposalGenerator,
  ProposalHandlers,
  type RuntimeValues,
} from "@xiangxu/application";
import { UUIDv7, parseRfc3339Instant } from "@xiangxu/domain";
import { expect, it } from "vitest";

import {
  BullMqCaptureTriageQueue,
  BullMqCaptureTriageWorker,
  OutboxDispatcher,
  PgCaptureTriageDispatchStore,
  type CaptureTriageJobIntent,
} from "../async/outbox-dispatcher.js";
import { createPostgresPool } from "./pool.js";
import { PgUnitOfWork } from "./unit-of-work.js";

const databaseUrl = required("DATABASE_URL");
const redisUrl = required("REDIS_URL");
const readyFile = required("XIANGXU_STAGE8_RUNTIME_READY");
const stopFile = required("XIANGXU_STAGE8_RUNTIME_STOP");

let counter = 0;
const runtime: RuntimeValues = {
  now: () => parseRfc3339Instant(new Date().toISOString()),
  newId: () => UUIDv7.parse(databaseUuid()),
};

it("runs the real Stage 8 Outbox dispatcher and BullMQ proposal worker", { timeout: 900_000 }, async () => {
  const pool = createPostgresPool(databaseUrl);
  const queue = new BullMqCaptureTriageQueue(redisUrl);
  const handler = new ProposalHandlers(
    new PgUnitOfWork(pool),
    runtime,
    new DeterministicStructuredProposalGenerator(),
  );
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
  const worker = new BullMqCaptureTriageWorker(redisUrl, (intent) => processor.process(intent));
  const dispatcher = new OutboxDispatcher(
    new PgCaptureTriageDispatchStore(pool),
    { add: (intent) => queue.add(intent) },
    "stage8-browser-dispatcher",
    5_000,
    100,
  );

  try {
    await queue.waitUntilReady();
    await worker.waitUntilReady();
    await writeFile(readyFile, "ready\n", "utf8");
    let heartbeatAt = Date.now();
    while (!existsSync(stopFile)) {
      while (await dispatcher.dispatchOne() !== null) {
        // Drain every durable triage intent before returning to the poll interval.
      }
      if (Date.now() - heartbeatAt >= 30_000) {
        console.log("Stage 8 dispatcher/worker heartbeat");
        heartbeatAt = Date.now();
      }
      await delay(50);
    }
    expect(existsSync(stopFile)).toBe(true);
  } finally {
    await worker.close(true);
    await queue.close();
    await pool.end();
  }
});

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function databaseUuid(): string {
  const milliseconds = BigInt(Date.now());
  counter = (counter + 1) & 0xfff;
  const timestamp = milliseconds.toString(16).padStart(12, "0").slice(-12);
  const random = createHash("sha256").update(`${Date.now()}:${counter}:${Math.random()}`).digest("hex");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${counter.toString(16).padStart(3, "0")}-8${random.slice(0, 3)}-${random.slice(3, 15)}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
