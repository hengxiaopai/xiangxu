import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readDatabaseIdentity(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000, max: 1 });
  try {
    const result = await pool.query(
      "SELECT current_database() AS database_name, version() AS version, pg_postmaster_start_time()::text AS started_at",
    );
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

export async function waitForStableDatabase(databaseUrl, timeoutMilliseconds = 60_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const first = await readDatabaseIdentity(databaseUrl);
      assert.equal(first?.database_name, "xiangxu_stage5");
      assert.match(first?.version ?? "", /PostgreSQL 18\.4/u);
      await delay(1_000);
      const second = await readDatabaseIdentity(databaseUrl);
      assert.equal(second?.started_at, first?.started_at);
      return second;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw new Error("PostgreSQL did not reach a stable Stage 5 SQL-ready state within 60 seconds", {
    cause: lastError,
  });
}

export async function migrateDatabase(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

export async function smokeDatabase(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const identity = await pool.query("SELECT current_database() AS database_name, version() AS version");
    assert.equal(identity.rows[0]?.database_name, "xiangxu_stage5");
    assert.match(identity.rows[0]?.version ?? "", /PostgreSQL 18\.4/u);

    const sentinel = await pool.query("SELECT to_regclass('public.infra_bootstrap_sentinel') AS relation");
    assert.equal(sentinel.rows[0]?.relation, "infra_bootstrap_sentinel");

    const history = await pool.query(
      "SELECT table_schema FROM information_schema.tables WHERE table_name = '__drizzle_migrations' ORDER BY table_schema",
    );
    assert.equal(history.rowCount, 1);
    const historySchema = history.rows[0]?.table_schema;
    assert.match(historySchema ?? "", /^[a-z_]+$/u);
    const historyCount = await pool.query(
      `SELECT COUNT(*)::integer AS count FROM "${historySchema}"."__drizzle_migrations"`,
    );
    assert.equal(historyCount.rows[0]?.count, 6);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query('DELETE FROM "infra_bootstrap_sentinel" WHERE id = $1', [1]);
      await client.query('INSERT INTO "infra_bootstrap_sentinel" (id) VALUES ($1)', [1]);
      const selected = await client.query(
        'SELECT id, created_at FROM "infra_bootstrap_sentinel" WHERE id = $1',
        [1],
      );
      assert.equal(selected.rows[0]?.id, 1);
      assert.ok(selected.rows[0]?.created_at instanceof Date);
      await client.query('DELETE FROM "infra_bootstrap_sentinel" WHERE id = $1', [1]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const remaining = await pool.query('SELECT COUNT(*)::integer AS count FROM "infra_bootstrap_sentinel"');
    assert.equal(remaining.rows[0]?.count, 0);
    return {
      database: identity.rows[0]?.database_name,
      migrationCount: historyCount.rows[0]?.count,
      postgresVersion: identity.rows[0]?.version,
      sentinelRowsAfterCleanup: remaining.rows[0]?.count,
    };
  } finally {
    await pool.end();
  }
}
