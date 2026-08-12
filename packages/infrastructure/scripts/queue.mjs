import assert from "node:assert/strict";

import { Queue, QueueEvents, Worker } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "xiangxu-infra-smoke";
const QUEUE_PREFIX = "xiangxu-stage5";
const JOB_ID = "stage5-fake-job";
const PAYLOAD = Object.freeze({ kind: "infrastructure-smoke", value: 7 });
const RESULT = Object.freeze({ kind: "infrastructure-smoke-result", value: 14 });

function assertQueueIdentity() {
  if (QUEUE_NAME !== "xiangxu-infra-smoke" || QUEUE_PREFIX !== "xiangxu-stage5") {
    throw new Error("Refusing destructive cleanup outside the XIANGXU Stage 5 smoke queue");
  }
}

export async function smokeQueue(redisUrl) {
  const healthClient = new Redis(redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const connection = { maxRetriesPerRequest: null, url: redisUrl };
  const queue = new Queue(QUEUE_NAME, { connection, prefix: QUEUE_PREFIX });
  let events;
  let worker;

  try {
    await healthClient.connect();
    assert.equal(await healthClient.ping(), "PONG");
    const info = await healthClient.info("server");
    const redisVersion = /^redis_version:([^\r\n]+)$/mu.exec(info)?.[1];
    assert.equal(redisVersion, "8.2.8");

    await queue.waitUntilReady();
    assertQueueIdentity();
    await queue.obliterate({ force: true });

    events = new QueueEvents(QUEUE_NAME, { connection, prefix: QUEUE_PREFIX });
    await events.waitUntilReady();
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        assert.deepEqual(job.data, PAYLOAD);
        return RESULT;
      },
      { connection, prefix: QUEUE_PREFIX },
    );
    await worker.waitUntilReady();

    const job = await queue.add("infrastructure-smoke", PAYLOAD, {
      jobId: JOB_ID,
      removeOnComplete: false,
      removeOnFail: true,
    });
    const result = await job.waitUntilFinished(events, 15_000);
    assert.deepEqual(result, RESULT);
    assert.equal(await job.getState(), "completed");

    return { jobId: job.id, payload: PAYLOAD, redisPing: "PONG", redisVersion, result, state: "completed" };
  } finally {
    if (worker) await worker.close(true);
    if (events) await events.close();
    assertQueueIdentity();
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
    if (healthClient.status !== "end") await healthClient.quit().catch(() => healthClient.disconnect());
  }
}
