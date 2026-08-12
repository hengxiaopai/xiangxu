import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { openApiArtifact } from "./openapi.mjs";

const temporaryArtifact = path.join(os.tmpdir(), `xiangxu-contract-drift-${process.pid}.json`);
const checker = fileURLToPath(new URL("./check-openapi.mjs", import.meta.url));

try {
  const committed = await fs.readFile(openApiArtifact, "utf8");
  await fs.writeFile(temporaryArtifact, `${committed} `, "utf8");
  const result = spawnSync(process.execPath, [checker, temporaryArtifact], { encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /Contract drift detected/);
  console.log(`Contract drift negative PASS — raw checker exit ${result.status}.`);
} finally {
  await fs.rm(temporaryArtifact, { force: true });
}
