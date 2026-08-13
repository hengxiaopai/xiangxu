import path from "node:path";
import { fileURLToPath } from "node:url";

import { run } from "./runtime.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const vitestEntry = path.join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");

export function runDatabaseIntegrationTests(databaseUrl, redisUrl) {
  run(process.execPath, [
    vitestEntry,
    "run",
    "--no-file-parallelism",
    "src/postgres/postgres.integration.test.ts",
    "src/postgres/time-block.integration.test.ts",
    "src/postgres/capture-proposal.integration.test.ts",
    "src/postgres/stage6-async.integration.test.ts",
    "src/postgres/stage7-daily-loop.integration.test.ts",
  ], {
    cwd: path.join(repositoryRoot, "packages", "infrastructure"),
    env: { ...process.env, DATABASE_URL: databaseUrl, REDIS_URL: redisUrl },
  });
}
