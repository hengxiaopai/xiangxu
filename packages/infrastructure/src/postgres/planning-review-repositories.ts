import type {
  ExecutionRecordRepository,
  OwnedPlanSnapshot,
  PlanSnapshotRepository,
  ReviewSnapshotRepository,
} from "@xiangxu/application";
import {
  UUIDv7,
  createExecutionRecord,
  createPlanSnapshot,
  createReviewSnapshot,
  parseIanaTimeZone,
  parseRfc3339Instant,
  type ActorRef,
  type ExecutionRecord,
  type IanaTimeZone,
  type ObjectRef,
  type PlanSnapshot,
  type ReviewSnapshot,
  type Rfc3339Instant,
  type UUIDv7 as UUIDv7Value,
} from "@xiangxu/domain";
import type { PoolClient } from "pg";

import { mapActorRef } from "./mapping.js";

interface PlanSnapshotRow {
  readonly id: string;
  readonly owner_id: string;
  readonly local_date: string;
  readonly timezone: string;
  readonly version: number;
  readonly capacity_minutes: number;
  readonly assumptions_and_evidence: readonly Readonly<{ objectType: string; id: string }>[];
  readonly committed_by_type: string;
  readonly committed_by_id: string;
  readonly committed_at: Date;
}

interface PlanSnapshotItemRow {
  readonly task_id: string;
  readonly item_order: number;
  readonly time_block_ids: readonly string[];
}

const planSelect = `
  SELECT id, owner_id, local_date::text, timezone, version, capacity_minutes,
         assumptions_and_evidence, committed_by_type, committed_by_id, committed_at
    FROM planning.plan_snapshots`;

function mapObjectRef(ref: Readonly<{ objectType: string; id: string }>): ObjectRef {
  const objectType = ref.objectType as ObjectRef["objectType"];
  const allowed: readonly ObjectRef["objectType"][] = [
    "task", "time_block", "capture_item", "raw_payload", "proposal", "plan_snapshot",
    "execution_record", "review_snapshot", "change_record",
  ];
  if (!allowed.includes(objectType)) throw new Error(`Unsupported snapshot object type: ${ref.objectType}`);
  return { objectType, id: UUIDv7.parse(ref.id) };
}

export class PgPlanSnapshotRepository implements PlanSnapshotRepository {
  constructor(private readonly client: PoolClient) {}

  async nextVersionUnderLock(ownerId: UUIDv7Value, date: string): Promise<number> {
    const result = await this.client.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0)::integer + 1 AS version
         FROM planning.plan_snapshots WHERE owner_id=$1 AND local_date=$2`,
      [ownerId, date],
    );
    const version = result.rows[0]?.version;
    if (version === undefined) throw new Error("PlanSnapshot version allocation failed");
    return version;
  }

  async insert(ownerId: UUIDv7Value, snapshot: PlanSnapshot): Promise<PlanSnapshot> {
    await this.client.query(
      `INSERT INTO planning.plan_snapshots
       (id, owner_id, local_date, timezone, version, capacity_minutes, assumptions_and_evidence,
        committed_by_type, committed_by_id, committed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
      [snapshot.id, ownerId, snapshot.date, snapshot.timezone, snapshot.version, snapshot.capacityMinutes,
        JSON.stringify(snapshot.assumptionsAndEvidence), snapshot.committedBy.actorType,
        snapshot.committedBy.actorId, snapshot.committedAt],
    );
    for (const item of snapshot.items) {
      await this.client.query(
        `INSERT INTO planning.plan_snapshot_items
         (plan_snapshot_id, task_id, item_order, time_block_ids)
         VALUES ($1,$2,$3,$4::uuid[])`,
        [snapshot.id, item.taskId, item.order, item.timeBlockIds],
      );
    }
    const inserted = await this.getById(snapshot.id);
    if (inserted === null) throw new Error("Inserted PlanSnapshot could not be read back");
    return inserted.snapshot;
  }

  async getById(id: UUIDv7Value): Promise<OwnedPlanSnapshot | null> {
    const result = await this.client.query<PlanSnapshotRow>(`${planSelect} WHERE id=$1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : this.map(row);
  }

  async getLatest(ownerId: UUIDv7Value, date: string, timezone: IanaTimeZone): Promise<PlanSnapshot | null> {
    const result = await this.client.query<PlanSnapshotRow>(
      `${planSelect} WHERE owner_id=$1 AND local_date=$2 AND timezone=$3 ORDER BY version DESC LIMIT 1`,
      [ownerId, date, timezone],
    );
    const row = result.rows[0];
    return row === undefined ? null : (await this.map(row)).snapshot;
  }

  private async map(row: PlanSnapshotRow): Promise<OwnedPlanSnapshot> {
    const items = await this.client.query<PlanSnapshotItemRow>(
      `SELECT task_id, item_order, time_block_ids
         FROM planning.plan_snapshot_items WHERE plan_snapshot_id=$1 ORDER BY item_order`,
      [row.id],
    );
    const snapshot = createPlanSnapshot({
      id: UUIDv7.parse(row.id),
      date: row.local_date,
      timezone: parseIanaTimeZone(row.timezone),
      version: row.version,
      capacityMinutes: row.capacity_minutes,
      items: items.rows.map((item) => ({
        taskId: UUIDv7.parse(item.task_id),
        order: item.item_order,
        timeBlockIds: item.time_block_ids.map(UUIDv7.parse),
      })),
      assumptionsAndEvidence: row.assumptions_and_evidence.map(mapObjectRef),
      committedBy: mapActorRef(row.committed_by_type, row.committed_by_id),
      committedAt: parseRfc3339Instant(row.committed_at.toISOString()),
    });
    return { ownerId: UUIDv7.parse(row.owner_id), snapshot };
  }
}

interface ExecutionRecordRow {
  readonly id: string;
  readonly target_object_id: string;
  readonly started_at: Date;
  readonly ended_at: Date;
  readonly duration_minutes: number;
  readonly outcome: ExecutionRecord["outcome"];
  readonly source: ExecutionRecord["source"];
  readonly plan_snapshot_id: string | null;
  readonly time_block_id: string | null;
}

export class PgExecutionRecordRepository implements ExecutionRecordRepository {
  constructor(private readonly client: PoolClient) {}

  async getOwnedByIds(ownerId: UUIDv7Value, ids: readonly UUIDv7Value[]): Promise<readonly ExecutionRecord[]> {
    if (ids.length === 0) return [];
    const result = await this.client.query<ExecutionRecordRow>(
      `SELECT id, target_object_id, started_at, ended_at, duration_minutes, outcome, source,
              plan_snapshot_id, time_block_id
         FROM planning.execution_records
        WHERE owner_id=$1 AND id=ANY($2::uuid[])`,
      [ownerId, ids],
    );
    const byId = new Map(result.rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (row === undefined) return [];
      return [createExecutionRecord({
        id: UUIDv7.parse(row.id),
        targetObjectId: UUIDv7.parse(row.target_object_id),
        startedAt: parseRfc3339Instant(row.started_at.toISOString()),
        endedAt: parseRfc3339Instant(row.ended_at.toISOString()),
        durationMinutes: row.duration_minutes,
        outcome: row.outcome,
        source: row.source,
        ...(row.plan_snapshot_id === null ? {} : { planSnapshotId: UUIDv7.parse(row.plan_snapshot_id) }),
        ...(row.time_block_id === null ? {} : { timeBlockId: UUIDv7.parse(row.time_block_id) }),
      })];
    });
  }
}

interface ReviewSnapshotRow {
  readonly id: string;
  readonly local_date: string;
  readonly timezone: string;
  readonly baseline_plan_snapshot_id: string;
  readonly final_plan_snapshot_id: string;
  readonly execution_record_ids: readonly string[];
  readonly what_changed: readonly Readonly<{ objectType: string; id: string }>[];
  readonly deterministic_metrics: Readonly<Record<string, number>>;
  readonly ai_insight_refs: readonly Readonly<{ objectType: string; id: string }>[];
  readonly tomorrow_proposal_id: string | null;
  readonly user_reflection_note_id: string | null;
}

const reviewSelect = `
  SELECT id, local_date::text, timezone, baseline_plan_snapshot_id, final_plan_snapshot_id,
         execution_record_ids, what_changed, deterministic_metrics, ai_insight_refs,
         tomorrow_proposal_id, user_reflection_note_id
    FROM planning.review_snapshots`;

function mapReview(row: ReviewSnapshotRow): ReviewSnapshot {
  return createReviewSnapshot({
    id: UUIDv7.parse(row.id),
    date: row.local_date,
    timezone: parseIanaTimeZone(row.timezone),
    baselinePlanSnapshotId: UUIDv7.parse(row.baseline_plan_snapshot_id),
    finalPlanSnapshotId: UUIDv7.parse(row.final_plan_snapshot_id),
    executionRecordIds: row.execution_record_ids.map(UUIDv7.parse),
    whatChanged: row.what_changed.map(mapObjectRef),
    derivedMetrics: row.deterministic_metrics,
    aiInsightRefs: row.ai_insight_refs.map(mapObjectRef),
    ...(row.tomorrow_proposal_id === null ? {} : { tomorrowProposalId: UUIDv7.parse(row.tomorrow_proposal_id) }),
    ...(row.user_reflection_note_id === null ? {} : { userReflectionNoteId: UUIDv7.parse(row.user_reflection_note_id) }),
  });
}

export class PgReviewSnapshotRepository implements ReviewSnapshotRepository {
  constructor(private readonly client: PoolClient) {}

  async nextVersionUnderLock(ownerId: UUIDv7Value, date: string): Promise<number> {
    const result = await this.client.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0)::integer + 1 AS version
         FROM planning.review_snapshots WHERE owner_id=$1 AND local_date=$2`,
      [ownerId, date],
    );
    const version = result.rows[0]?.version;
    if (version === undefined) throw new Error("ReviewSnapshot version allocation failed");
    return version;
  }

  async insert(
    ownerId: UUIDv7Value,
    version: number,
    createdBy: ActorRef,
    createdAt: Rfc3339Instant,
    snapshot: ReviewSnapshot,
  ): Promise<ReviewSnapshot> {
    const result = await this.client.query<ReviewSnapshotRow>(
      `INSERT INTO planning.review_snapshots
       (id, owner_id, local_date, timezone, version, baseline_plan_snapshot_id, final_plan_snapshot_id,
        execution_record_ids, what_changed, deterministic_metrics, ai_insight_refs,
        tomorrow_proposal_id, user_reflection_note_id, created_by_type, created_by_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::uuid[],$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16)
       RETURNING id, local_date::text, timezone, baseline_plan_snapshot_id, final_plan_snapshot_id,
                 execution_record_ids, what_changed, deterministic_metrics, ai_insight_refs,
                 tomorrow_proposal_id, user_reflection_note_id`,
      [snapshot.id, ownerId, snapshot.date, snapshot.timezone, version, snapshot.baselinePlanSnapshotId,
        snapshot.finalPlanSnapshotId, snapshot.executionRecordIds, JSON.stringify(snapshot.whatChanged),
        JSON.stringify(snapshot.derivedMetrics), JSON.stringify(snapshot.aiInsightRefs),
        snapshot.tomorrowProposalId ?? null, snapshot.userReflectionNoteId ?? null,
        createdBy.actorType, createdBy.actorId, createdAt],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("ReviewSnapshot insert did not return a row");
    return mapReview(row);
  }

  async getLatest(ownerId: UUIDv7Value, date: string, timezone: IanaTimeZone): Promise<ReviewSnapshot | null> {
    const result = await this.client.query<ReviewSnapshotRow>(
      `${reviewSelect} WHERE owner_id=$1 AND local_date=$2 AND timezone=$3 ORDER BY version DESC LIMIT 1`,
      [ownerId, date, timezone],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapReview(row);
  }
}
