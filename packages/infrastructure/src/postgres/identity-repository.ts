import type { CreateDeviceSessionInput, DeviceSessionRecord, DeviceSessionRepository, DevUserRepository } from "@xiangxu/application";
import { UUIDv7, parseRfc3339Instant, type Rfc3339Instant } from "@xiangxu/domain";
import type { Pool } from "pg";

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly expires_at: Date;
  readonly revoked_at: Date | null;
  readonly created_at: Date;
}

function mapSession(row: SessionRow): DeviceSessionRecord {
  return {
    id: UUIDv7.parse(row.id),
    userId: UUIDv7.parse(row.user_id),
    expiresAt: parseRfc3339Instant(row.expires_at.toISOString()),
    createdAt: parseRfc3339Instant(row.created_at.toISOString()),
    ...(row.revoked_at === null ? {} : { revokedAt: parseRfc3339Instant(row.revoked_at.toISOString()) }),
  };
}

export class PgIdentityRepository implements DevUserRepository {
  constructor(private readonly pool: Pool) {}

  async ensureDevUser(devSubject: string) {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO identity.users (dev_subject) VALUES ($1)
       ON CONFLICT (dev_subject) DO UPDATE SET dev_subject = EXCLUDED.dev_subject
       RETURNING id`,
      [devSubject],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error("Dev user insert did not return an ID");
    return UUIDv7.parse(id);
  }
}

export class PgDeviceSessionRepository implements DeviceSessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateDeviceSessionInput): Promise<DeviceSessionRecord> {
    const result = await this.pool.query<SessionRow>(
      `INSERT INTO identity.device_sessions (user_id, token_hash, expires_at)
       VALUES ($1,$2,$3)
       RETURNING id, user_id, expires_at, revoked_at, created_at`,
      [input.userId, input.tokenHash, input.expiresAt],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Session insert did not return a row");
    return mapSession(row);
  }

  async findActiveByTokenHash(tokenHash: string, asOf: Rfc3339Instant): Promise<DeviceSessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, expires_at, revoked_at, created_at
         FROM identity.device_sessions
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [tokenHash, asOf],
    );
    return result.rows[0] === undefined ? null : mapSession(result.rows[0]);
  }

  async revoke(id: DeviceSessionRecord["id"], revokedAt: Rfc3339Instant): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE identity.device_sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL`,
      [id, revokedAt],
    );
    return result.rowCount === 1;
  }
}
