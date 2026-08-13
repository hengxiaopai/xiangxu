import type {
  CasResult,
  PlanningLock,
  TimeBlockCasPatch,
  TimeBlockRepository,
} from "@xiangxu/application";
import {
  Revision,
  UUIDv7,
  createTimeBlock,
  type TimeBlock,
  type UUIDv7 as UUIDv7Value,
} from "@xiangxu/domain";
import type { PoolClient } from "pg";

interface TimeBlockRow {
  readonly id: string;
  readonly owner_id: string;
  readonly task_id: string;
  readonly start_at: Date;
  readonly end_at: Date;
  readonly timezone: string;
  readonly locked: boolean;
  readonly revision: string;
}

const selectTimeBlock = `
  SELECT id, owner_id, task_id, start_at, end_at, timezone, locked, revision::text
    FROM planning.time_blocks`;

function mapTimeBlock(row: TimeBlockRow): TimeBlock {
  return createTimeBlock({
    id: UUIDv7.parse(row.id),
    ownerId: UUIDv7.parse(row.owner_id),
    taskId: UUIDv7.parse(row.task_id),
    startAt: row.start_at.toISOString(),
    endAt: row.end_at.toISOString(),
    timezone: row.timezone,
    locked: row.locked,
    revision: Revision.parseBigInt(row.revision),
  });
}

export class PgTimeBlockRepository implements TimeBlockRepository {
  constructor(private readonly client: PoolClient) {}

  async insert(block: TimeBlock): Promise<TimeBlock> {
    const result = await this.client.query<TimeBlockRow>(
      `INSERT INTO planning.time_blocks
       (id, owner_id, task_id, start_at, end_at, timezone, locked, revision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, owner_id, task_id, start_at, end_at, timezone, locked, revision::text`,
      [block.id, block.ownerId, block.taskId, block.startAt, block.endAt, block.timezone, block.locked, block.revision.toString()],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("TimeBlock insert did not return a row");
    return mapTimeBlock(row);
  }

  async getById(id: UUIDv7Value): Promise<TimeBlock | null> {
    const result = await this.client.query<TimeBlockRow>(`${selectTimeBlock} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : mapTimeBlock(row);
  }

  async updateCas(id: UUIDv7Value, baseRevision: Revision, patch: TimeBlockCasPatch): Promise<CasResult<TimeBlock>> {
    const result = await this.client.query<TimeBlockRow>(
      `UPDATE planning.time_blocks
          SET start_at = $3, end_at = $4, timezone = $5, revision = revision + 1, updated_at = now()
        WHERE id = $1 AND revision = $2
        RETURNING id, owner_id, task_id, start_at, end_at, timezone, locked, revision::text`,
      [id, baseRevision.toString(), patch.startAt, patch.endAt, patch.timezone],
    );
    const row = result.rows[0];
    if (row === undefined) return { outcome: "conflict" };
    const value = mapTimeBlock(row);
    return { outcome: "updated", value, newRevision: value.revision };
  }

  async findOverlap(
    ownerId: UUIDv7Value,
    startAt: TimeBlock["startAt"],
    endAt: TimeBlock["endAt"],
    excludeId?: UUIDv7Value,
  ): Promise<TimeBlock | null> {
    const result = await this.client.query<TimeBlockRow>(
      `${selectTimeBlock}
        WHERE owner_id = $1
          AND start_at < $3
          AND end_at > $2
          AND ($4::uuid IS NULL OR id <> $4)
        ORDER BY start_at, id
        LIMIT 1`,
      [ownerId, startAt, endAt, excludeId ?? null],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapTimeBlock(row);
  }
}

export class PgPlanningLock implements PlanningLock {
  constructor(private readonly client: PoolClient) {}

  async acquireOwner(ownerId: UUIDv7Value): Promise<void> {
    await this.client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`xiangxu:planning:${ownerId}`]);
  }

  async acquireDaily(ownerId: UUIDv7Value, date: string): Promise<void> {
    await this.client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`xiangxu:planning:${ownerId}:${date}`]);
  }
}
