import type {
  IdempotencyKeyIdentity,
  IdempotencyRepository,
  IdempotencyReservation,
  StoredCommandResult,
} from "@xiangxu/application";
import { Revision } from "@xiangxu/domain";
import type { Pool, PoolClient } from "pg";

interface IdempotencyRow {
  readonly request_fingerprint: string;
  readonly state: "in_progress" | "completed";
  readonly stored_status: number | null;
  readonly stored_body: Record<string, unknown> | null;
  readonly stored_etag_revision: string | null;
}

const values = (identity: IdempotencyKeyIdentity) => [
  identity.actor.actorType,
  identity.actor.actorId,
  identity.commandType,
  identity.idempotencyKey,
  identity.requestFingerprint,
];

export class PgIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async reserve(identity: IdempotencyKeyIdentity): Promise<IdempotencyReservation> {
    const inserted = await this.pool.query(
      `INSERT INTO infra.idempotency_keys
       (actor_type, actor_id, command_type, idempotency_key, request_fingerprint)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING RETURNING actor_id`,
      values(identity),
    );
    if (inserted.rowCount === 1) return { outcome: "first-execution" };

    const existing = await this.pool.query<IdempotencyRow>(
      `SELECT request_fingerprint, state, stored_status, stored_body, stored_etag_revision::text
         FROM infra.idempotency_keys
        WHERE actor_type=$1 AND actor_id=$2 AND command_type=$3 AND idempotency_key=$4`,
      values(identity).slice(0, 4),
    );
    const row = existing.rows[0];
    if (row === undefined) throw new Error("Idempotency conflict row disappeared");
    if (row.request_fingerprint !== identity.requestFingerprint) return { outcome: "conflict" };
    if (row.state === "in_progress") return { outcome: "in-progress" };
    if (row.stored_status === null || row.stored_body === null) throw new Error("Completed idempotency row lacks stored result");
    return {
      outcome: "exact-replay",
      storedResult: {
        status: row.stored_status,
        body: row.stored_body,
        ...(row.stored_etag_revision === null ? {} : { etagRevision: Revision.parseBigInt(row.stored_etag_revision) }),
      },
    };
  }

  async complete(identity: IdempotencyKeyIdentity, result: StoredCommandResult): Promise<void> {
    const updated = await this.pool.query(
      `UPDATE infra.idempotency_keys
          SET state='completed', stored_status=$6, stored_body=$7::jsonb,
              stored_etag_revision=$8, completed_at=now()
        WHERE actor_type=$1 AND actor_id=$2 AND command_type=$3 AND idempotency_key=$4
          AND request_fingerprint=$5 AND state='in_progress'`,
      [...values(identity), result.status, JSON.stringify(result.body), result.etagRevision?.toString() ?? null],
    );
    if (updated.rowCount !== 1) throw new Error("Idempotency completion did not own the reserved execution");
  }
}
