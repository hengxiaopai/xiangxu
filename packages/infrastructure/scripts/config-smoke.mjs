import assert from "node:assert/strict";

import { assertStage5LocalConfig, readInfrastructureConfig } from "./config.mjs";

assert.throws(
  () => readInfrastructureConfig({ REDIS_URL: "redis://127.0.0.1:6379/0" }),
  /DATABASE_URL is required/,
);
assert.throws(
  () => readInfrastructureConfig({ DATABASE_URL: "postgresql://local@127.0.0.1:55432/xiangxu_stage5" }),
  /REDIS_URL is required/,
);

const valid = readInfrastructureConfig({
  DATABASE_URL: "postgresql://local@127.0.0.1:55432/xiangxu_stage5",
  REDIS_URL: "redis://127.0.0.1:6379/0",
});
assertStage5LocalConfig(valid);

assert.throws(
  () =>
    assertStage5LocalConfig({
      databaseUrl: "postgresql://local@127.0.0.1:5432/xiangxu_stage5",
      redisUrl: valid.redisUrl,
    }),
  /Refusing operation/,
);

console.log("Infrastructure config smoke PASS — missing values fail closed; fixed local Stage 5 identity passes.");
