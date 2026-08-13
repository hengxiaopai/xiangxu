import type { TransactionRepositories, UnitOfWork } from "@xiangxu/application";
import type { Pool } from "pg";

import { PgChangeRecordRepository, PgOutboxRepository } from "./audit-outbox-repositories.js";
import { PgCaptureRepository, PgProposalRepository } from "./capture-proposal-repositories.js";
import { PgIdempotencyRepository } from "./idempotency-repository.js";
import { PgTaskRepository } from "./task-repository.js";
import { PgPlanningLock, PgTimeBlockRepository } from "./time-block-repository.js";
import {
  PgExecutionRecordRepository,
  PgPlanSnapshotRepository,
  PgReviewSnapshotRepository,
} from "./planning-review-repositories.js";

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(operation: (repositories: TransactionRepositories) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation({
        tasks: new PgTaskRepository(client),
        timeBlocks: new PgTimeBlockRepository(client),
        planningLock: new PgPlanningLock(client),
        planSnapshots: new PgPlanSnapshotRepository(client),
        executionRecords: new PgExecutionRecordRepository(client),
        reviewSnapshots: new PgReviewSnapshotRepository(client),
        captures: new PgCaptureRepository(client),
        proposals: new PgProposalRepository(client),
        changes: new PgChangeRecordRepository(client),
        outbox: new PgOutboxRepository(client),
        idempotency: new PgIdempotencyRepository(client),
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
