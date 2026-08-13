import { Queue, Worker, type Job } from "bullmq";
import { UUIDv7 } from "@xiangxu/domain";
import type { Pool } from "pg";

export const CAPTURE_TRIAGE_QUEUE = "xiangxu-capture-triage";
export const CAPTURE_TRIAGE_QUEUE_PREFIX = "xiangxu-stage6";
export const CAPTURE_TRIAGE_JOB = "capture.triage.generate";

export interface CaptureTriageJobIntent {
  readonly outboxEventId: string;
  readonly outboxSequence: string;
  readonly captureId: string;
  readonly commandId: string;
  readonly correlationId: string;
}

export interface ClaimedCaptureTriageIntent extends CaptureTriageJobIntent {
  readonly claimedBy: string;
  readonly attempts: number;
}

interface CaptureTriageQueue {
  add(intent: CaptureTriageJobIntent): Promise<void>;
}

export class PgCaptureTriageDispatchStore {
  constructor(private readonly pool: Pool) {}

  async claimOne(
    dispatcherId: string,
    now: Date,
    leaseMilliseconds: number,
  ): Promise<ClaimedCaptureTriageIntent | null> {
    if (dispatcherId.length === 0) throw new Error("Dispatcher ID is required");
    if (!Number.isInteger(leaseMilliseconds) || leaseMilliseconds < 1) throw new Error("Claim lease must be positive");
    const staleBefore = new Date(now.getTime() - leaseMilliseconds);
    const result = await this.pool.query<{
      sequence: string;
      id: string;
      target_id: string;
      command_id: string;
      correlation_id: string;
      claimed_by: string;
      attempts: number;
    }>(
      `WITH next_intent AS (
         SELECT sequence
           FROM infra.outbox_events
          WHERE topic = 'capture.triage.requested'
            AND available_at <= $1
            AND (
              status IN ('pending','failed')
              OR (status = 'claimed' AND claimed_at <= $2)
            )
          ORDER BY sequence
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE infra.outbox_events AS event
          SET status = 'claimed', claimed_at = $1, claimed_by = $3,
              attempts = event.attempts + 1, last_error = NULL
         FROM next_intent
        WHERE event.sequence = next_intent.sequence
       RETURNING event.sequence::text, event.id::text, event.target_id::text,
                 event.command_id::text, event.correlation_id::text,
                 event.claimed_by, event.attempts`,
      [now, staleBefore, dispatcherId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      outboxEventId: UUIDv7.parse(row.id),
      outboxSequence: positiveSequence(row.sequence),
      captureId: UUIDv7.parse(row.target_id),
      commandId: UUIDv7.parse(row.command_id),
      correlationId: UUIDv7.parse(row.correlation_id),
      claimedBy: row.claimed_by,
      attempts: row.attempts,
    };
  }

  async markPublished(intent: ClaimedCaptureTriageIntent, publishedAt: Date): Promise<void> {
    const result = await this.pool.query(
      `UPDATE infra.outbox_events
          SET status='published', published_at=$3, claimed_at=NULL, claimed_by=NULL, last_error=NULL
        WHERE sequence=$1 AND status='claimed' AND claimed_by=$2
          AND topic='capture.triage.requested'`,
      [intent.outboxSequence, intent.claimedBy, publishedAt],
    );
    if (result.rowCount !== 1) throw new Error("Outbox publish acknowledgement lost its active claim");
  }

  async markRetryableFailure(
    intent: ClaimedCaptureTriageIntent,
    error: unknown,
    availableAt: Date,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const result = await this.pool.query(
      `UPDATE infra.outbox_events
          SET status='failed', available_at=$3, claimed_at=NULL, claimed_by=NULL,
              last_error=left($4, 2000)
        WHERE sequence=$1 AND status='claimed' AND claimed_by=$2
          AND topic='capture.triage.requested'`,
      [intent.outboxSequence, intent.claimedBy, availableAt, message],
    );
    if (result.rowCount !== 1) throw new Error("Outbox failure update lost its active claim");
  }
}

export interface DispatchHooks {
  afterClaim?(intent: ClaimedCaptureTriageIntent): Promise<void> | void;
  afterEnqueue?(intent: ClaimedCaptureTriageIntent): Promise<void> | void;
}

export class OutboxDispatcher {
  constructor(
    private readonly store: PgCaptureTriageDispatchStore,
    private readonly queue: CaptureTriageQueue,
    private readonly dispatcherId: string,
    private readonly leaseMilliseconds = 30_000,
    private readonly retryDelayMilliseconds = 1_000,
  ) {}

  async dispatchOne(now = new Date(), hooks: DispatchHooks = {}): Promise<ClaimedCaptureTriageIntent | null> {
    const intent = await this.store.claimOne(this.dispatcherId, now, this.leaseMilliseconds);
    if (intent === null) return null;
    await hooks.afterClaim?.(intent);
    try {
      await this.queue.add(intent);
    } catch (error) {
      await this.store.markRetryableFailure(intent, error, new Date(now.getTime() + this.retryDelayMilliseconds));
      throw error;
    }
    await hooks.afterEnqueue?.(intent);
    await this.store.markPublished(intent, now);
    return intent;
  }
}

export class BullMqCaptureTriageQueue implements CaptureTriageQueue {
  private readonly queue: Queue<CaptureTriageJobIntent>;

  constructor(redisUrl: string) {
    this.queue = new Queue(CAPTURE_TRIAGE_QUEUE, {
      connection: {
        url: redisUrl,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 500,
        retryStrategy: () => null,
      },
      prefix: CAPTURE_TRIAGE_QUEUE_PREFIX,
    });
    this.queue.on("error", () => undefined);
  }

  async waitUntilReady(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async add(intent: CaptureTriageJobIntent): Promise<void> {
    const parsed = parseCaptureTriageJobIntent(intent);
    await this.queue.add(CAPTURE_TRIAGE_JOB, parsed, {
      jobId: parsed.outboxEventId,
      attempts: 3,
      backoff: { type: "fixed", delay: 250 },
      removeOnComplete: false,
      removeOnFail: false,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  async jobState(outboxEventId: string): Promise<string | undefined> {
    return (await this.queue.getJob(UUIDv7.parse(outboxEventId)))?.getState();
  }

  async obliterate(): Promise<void> {
    await this.queue.obliterate({ force: true });
  }
}

export class BullMqCaptureTriageWorker {
  private readonly worker: Worker<CaptureTriageJobIntent>;

  constructor(redisUrl: string, process: (intent: CaptureTriageJobIntent) => Promise<unknown>) {
    this.worker = new Worker<CaptureTriageJobIntent>(
      CAPTURE_TRIAGE_QUEUE,
      async (job: Job<CaptureTriageJobIntent>) => {
        if (job.name !== CAPTURE_TRIAGE_JOB) throw new Error(`Unsupported XIANGXU job: ${job.name}`);
        return process(parseCaptureTriageJobIntent(job.data));
      },
      {
        connection: { url: redisUrl, maxRetriesPerRequest: null },
        prefix: CAPTURE_TRIAGE_QUEUE_PREFIX,
      },
    );
    this.worker.on("error", () => undefined);
  }

  async waitUntilReady(): Promise<void> {
    await this.worker.waitUntilReady();
  }

  async close(force = false): Promise<void> {
    await this.worker.close(force);
  }
}

export function parseCaptureTriageJobIntent(value: CaptureTriageJobIntent): CaptureTriageJobIntent {
  return {
    outboxEventId: UUIDv7.parse(value.outboxEventId),
    outboxSequence: positiveSequence(value.outboxSequence),
    captureId: UUIDv7.parse(value.captureId),
    commandId: UUIDv7.parse(value.commandId),
    correlationId: UUIDv7.parse(value.correlationId),
  };
}

function positiveSequence(value: string): string {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("Outbox sequence must be a positive decimal bigint");
  BigInt(value);
  return value;
}
