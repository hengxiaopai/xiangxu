import type {
  CaptureTriageRequested,
  ChangeRecordRepository,
  DurableOutboxRecord,
  OutboxRepository,
} from "@xiangxu/application";
import { UUIDv7, type ChangeRecord, type DurableEvent, type ObjectRef, type Rfc3339Instant } from "@xiangxu/domain";
import type { PoolClient } from "pg";

import { mapChangeRecordRow, mapObjectType, mapOutboxRow, type ChangeRecordRow, type OutboxRow } from "./mapping.js";

export class PgChangeRecordRepository implements ChangeRecordRepository {
  constructor(private readonly client: PoolClient) {}

  async append(record: ChangeRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO audit.change_records
       (id, target_type, target_id, base_revision, new_revision, actor_type, actor_id, command,
        changed_field_families, patch_before, patch_after, source_context, command_id, correlation_id,
        proposal_id, undo_of, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17)`,
      [record.id, record.entityRef.objectType, record.entityRef.id, record.baseRevision.toString(), record.newRevision.toString(),
        record.actor.actorType, record.actor.actorId, record.command, JSON.stringify(record.changedFieldFamilies), "{}", "{}",
        JSON.stringify(record.sourceContext), record.correlationId, record.correlationId, record.proposalId ?? null,
        record.undoOf ?? null, record.createdAt],
    );
  }

  async readByCorrelationId(correlationId: UUIDv7): Promise<readonly ChangeRecord[]> {
    const result = await this.client.query<ChangeRecordRow>(
      `SELECT id, target_type, target_id, base_revision::text, new_revision::text, actor_type, actor_id,
              command, changed_field_families, source_context, correlation_id, proposal_id, undo_of, created_at
         FROM audit.change_records WHERE correlation_id = $1 ORDER BY created_at, id`,
      [correlationId],
    );
    return result.rows.map(mapChangeRecordRow);
  }

  async readChangedRefs(actorId: UUIDv7, from: Rfc3339Instant, through: Rfc3339Instant): Promise<readonly ObjectRef[]> {
    const result = await this.client.query<{ target_type: string; target_id: string }>(
      `SELECT target_type, target_id::text
         FROM audit.change_records
        WHERE actor_id=$1 AND created_at>$2 AND created_at<=$3
        GROUP BY target_type, target_id
        ORDER BY target_type, target_id`,
      [actorId, from, through],
    );
    return result.rows.map((row) => ({ objectType: mapObjectType(row.target_type), id: UUIDv7.parse(row.target_id) }));
  }
}

export class PgOutboxRepository implements OutboxRepository {
  constructor(private readonly client: PoolClient) {}

  async append(event: DurableEvent): Promise<bigint> {
    const target = event.affectedRefs[0];
    if (target === undefined) throw new Error("Outbox event requires an affected ref");
    const payload = { affectedRefs: event.affectedRefs, projectionHints: event.projectionHints };
    const result = await this.client.query<{ sequence: string }>(
      `INSERT INTO infra.outbox_events
       (id, topic, target_type, target_id, revision, payload, command_id, correlation_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING sequence::text`,
      [event.eventId, event.topic, target.objectType, target.id, event.revision?.toString() ?? null,
        JSON.stringify(payload), event.commandId, event.correlationId, event.occurredAt],
    );
    const sequence = result.rows[0]?.sequence;
    if (sequence === undefined) throw new Error("Outbox insert did not return a sequence");
    return BigInt(sequence);
  }

  async appendCaptureTriageRequested(intent: CaptureTriageRequested): Promise<bigint> {
    const payload = { affectedRefs: [{ objectType: "capture_item", id: intent.captureId }], projectionHints: [] };
    const result = await this.client.query<{ sequence: string }>(
      `INSERT INTO infra.outbox_events
       (id, topic, target_type, target_id, revision, payload, command_id, correlation_id, created_at)
       VALUES ($1,'capture.triage.requested','capture_item',$2,NULL,$3::jsonb,$4,$5,$6)
       RETURNING sequence::text`,
      [intent.eventId, intent.captureId, JSON.stringify(payload), intent.commandId, intent.correlationId, intent.occurredAt],
    );
    const sequence = result.rows[0]?.sequence;
    if (sequence === undefined) throw new Error("Outbox insert did not return a sequence");
    return BigInt(sequence);
  }

  async readByCorrelationId(correlationId: UUIDv7): Promise<readonly DurableOutboxRecord[]> {
    const result = await this.client.query<OutboxRow>(
      `SELECT sequence::text, id, topic, payload, revision::text, command_id, correlation_id, created_at, status
         FROM infra.outbox_events
        WHERE correlation_id = $1 AND topic IN ('object.changed','proposal.ready')
        ORDER BY sequence`,
      [correlationId],
    );
    return result.rows.map(mapOutboxRow);
  }
}
