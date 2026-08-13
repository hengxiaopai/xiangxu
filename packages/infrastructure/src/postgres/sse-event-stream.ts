import { UUIDv7 } from "@xiangxu/domain";
import type { Pool } from "pg";

const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;
export type SseEligibleTopic = "object.changed" | "proposal.ready";

export type PersistedSseEvent =
  | {
      readonly event: "object.changed";
      readonly id: string;
      readonly version: "1";
      readonly data: {
        readonly affectedRefs: readonly { readonly objectType: string; readonly id: string }[];
        readonly projectionHints: readonly string[];
        readonly revision: string;
        readonly changedFieldFamilies: readonly string[];
      };
    }
  | {
      readonly event: "proposal.ready";
      readonly id: string;
      readonly version: "1";
      readonly data: {
        readonly affectedRefs: readonly { readonly objectType: string; readonly id: string }[];
        readonly projectionHints: readonly string[];
        readonly proposalId: string;
        readonly capability: string;
        readonly surfaceHint: string;
        readonly riskLevel: "low" | "medium" | "high";
      };
    };

export interface SseReplayBatch {
  readonly events: readonly PersistedSseEvent[];
  readonly resyncRequired: boolean;
  readonly latestEventId: string;
}

interface SseEventRow {
  readonly sequence: string;
  readonly topic: SseEligibleTopic;
  readonly target_id: string;
  readonly revision: string | null;
  readonly payload: {
    readonly affectedRefs: readonly { readonly objectType: string; readonly id: string }[];
    readonly projectionHints: readonly string[];
  };
  readonly changed_field_families: readonly string[] | null;
  readonly risk_level: string | null;
}

export class PgSseEventStream {
  constructor(private readonly pool: Pool) {}

  async currentCursor(): Promise<string> {
    const result = await this.pool.query<{ cursor: string }>(
      "SELECT COALESCE(max(sequence), 0)::text AS cursor FROM infra.outbox_events",
    );
    return parseDurableCursor(result.rows[0]?.cursor ?? "0");
  }

  async replay(
    actorId: string,
    lastEventId: string,
    channels: readonly SseEligibleTopic[],
    limit: number,
  ): Promise<SseReplayBatch> {
    const actor = UUIDv7.parse(actorId);
    const cursor = parseDurableCursor(lastEventId);
    if (!Number.isInteger(limit) || limit < 1) throw new Error("SSE replay limit must be positive");
    if (channels.length === 0) return { events: [], resyncRequired: false, latestEventId: cursor };
    const selected = [...new Set(channels)];
    const result = await this.pool.query<SseEventRow>(
      `SELECT event.sequence::text, event.topic, event.target_id::text,
              event.revision::text, event.payload,
              change.changed_field_families, proposal.risk_level
         FROM infra.outbox_events AS event
         LEFT JOIN LATERAL (
           SELECT record.changed_field_families
             FROM audit.change_records AS record
            WHERE record.correlation_id = event.correlation_id
              AND record.target_type = event.target_type
              AND record.target_id = event.target_id
            ORDER BY record.created_at DESC, record.id DESC
            LIMIT 1
         ) AS change ON event.topic = 'object.changed'
         LEFT JOIN ai.proposals AS proposal
           ON event.topic = 'proposal.ready' AND proposal.id = event.target_id
        WHERE event.sequence > $1
          AND event.topic = ANY($2::text[])
          AND (
            (event.target_type = 'task' AND EXISTS (
              SELECT 1 FROM core.objects AS object
               WHERE object.id = event.target_id AND object.owner_id = $3
            ))
            OR (event.target_type = 'time_block' AND EXISTS (
              SELECT 1 FROM planning.time_blocks AS block
               WHERE block.id = event.target_id AND block.owner_id = $3
            ))
            OR (event.target_type = 'capture_item' AND EXISTS (
              SELECT 1 FROM capture.capture_items AS capture
               WHERE capture.id = event.target_id AND capture.owner_id = $3
            ))
            OR (event.target_type = 'proposal' AND EXISTS (
              SELECT 1
                FROM ai.proposal_targets AS target
                JOIN capture.capture_items AS capture
                  ON target.target_type = 'capture_item' AND capture.id = target.target_id
               WHERE target.proposal_id = event.target_id AND capture.owner_id = $3
            ))
            OR (event.target_type = 'plan_snapshot' AND EXISTS (
              SELECT 1 FROM planning.plan_snapshots AS snapshot
               WHERE snapshot.id = event.target_id AND snapshot.owner_id = $3
            ))
            OR (event.target_type = 'execution_record' AND EXISTS (
              SELECT 1 FROM planning.execution_records AS execution
               WHERE execution.id = event.target_id AND execution.owner_id = $3
            ))
            OR (event.target_type = 'review_snapshot' AND EXISTS (
              SELECT 1 FROM planning.review_snapshots AS review
               WHERE review.id = event.target_id AND review.owner_id = $3
            ))
            OR (event.target_type = 'library' AND EXISTS (
              SELECT 1 FROM knowledge.libraries AS library
               WHERE library.id = event.target_id AND library.owner_id = $3
            ))
          )
        ORDER BY event.sequence
        LIMIT $4`,
      [cursor, selected, actor, limit + 1],
    );
    const hasOverflow = result.rows.length > limit;
    if (hasOverflow) {
      const latest = await this.latestEligibleCursor(actor, selected);
      return { events: [], resyncRequired: true, latestEventId: latest };
    }
    const events = result.rows.map(mapSseEvent);
    const latestEventId = events.at(-1)?.id ?? cursor;
    return { events, resyncRequired: false, latestEventId };
  }

  private async latestEligibleCursor(actorId: string, channels: readonly SseEligibleTopic[]): Promise<string> {
    const result = await this.pool.query<{ cursor: string }>(
      `SELECT COALESCE(max(event.sequence), 0)::text AS cursor
         FROM infra.outbox_events AS event
        WHERE event.topic = ANY($1::text[])
          AND (
            (event.target_type = 'task' AND EXISTS (
              SELECT 1 FROM core.objects AS object WHERE object.id=event.target_id AND object.owner_id=$2
            ))
            OR (event.target_type = 'time_block' AND EXISTS (
              SELECT 1 FROM planning.time_blocks AS block WHERE block.id=event.target_id AND block.owner_id=$2
            ))
            OR (event.target_type = 'capture_item' AND EXISTS (
              SELECT 1 FROM capture.capture_items AS capture WHERE capture.id=event.target_id AND capture.owner_id=$2
            ))
            OR (event.target_type = 'proposal' AND EXISTS (
              SELECT 1 FROM ai.proposal_targets AS target
              JOIN capture.capture_items AS capture
                ON target.target_type='capture_item' AND capture.id=target.target_id
              WHERE target.proposal_id=event.target_id AND capture.owner_id=$2
            ))
            OR (event.target_type = 'plan_snapshot' AND EXISTS (
              SELECT 1 FROM planning.plan_snapshots AS snapshot
              WHERE snapshot.id=event.target_id AND snapshot.owner_id=$2
            ))
            OR (event.target_type = 'execution_record' AND EXISTS (
              SELECT 1 FROM planning.execution_records AS execution
              WHERE execution.id=event.target_id AND execution.owner_id=$2
            ))
            OR (event.target_type = 'review_snapshot' AND EXISTS (
              SELECT 1 FROM planning.review_snapshots AS review
              WHERE review.id=event.target_id AND review.owner_id=$2
            ))
            OR (event.target_type = 'library' AND EXISTS (
              SELECT 1 FROM knowledge.libraries AS library
              WHERE library.id=event.target_id AND library.owner_id=$2
            ))
          )`,
      [channels, actorId],
    );
    return parseDurableCursor(result.rows[0]?.cursor ?? "0");
  }
}

export function parseDurableCursor(value: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("Last-Event-ID must be a decimal durable sequence");
  const parsed = BigInt(value);
  if (parsed > POSTGRES_BIGINT_MAX) throw new Error("Last-Event-ID exceeds PostgreSQL bigint");
  return value;
}

function mapSseEvent(row: SseEventRow): PersistedSseEvent {
  const id = parseDurableCursor(row.sequence);
  if (row.topic === "object.changed") {
    if (row.revision === null) throw new Error("object.changed requires a persisted revision");
    return {
      event: "object.changed",
      id,
      version: "1",
      data: {
        affectedRefs: row.payload.affectedRefs,
        projectionHints: row.payload.projectionHints,
        revision: row.revision,
        changedFieldFamilies: row.changed_field_families ?? [],
      },
    };
  }
  if (!(row.risk_level === "low" || row.risk_level === "medium" || row.risk_level === "high")) {
    throw new Error("proposal.ready requires canonical Proposal risk");
  }
  return {
    event: "proposal.ready",
    id,
    version: "1",
    data: {
      affectedRefs: row.payload.affectedRefs,
      projectionHints: row.payload.projectionHints,
      proposalId: UUIDv7.parse(row.target_id),
      capability: "structured-triage",
      surfaceHint: "capture",
      riskLevel: row.risk_level,
    },
  };
}
