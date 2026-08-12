import fs from "node:fs/promises";
import path from "node:path";

import { openApiArtifact, serializeOpenApiDocument } from "./openapi.mjs";

const artifact = path.resolve(process.argv[2] ?? openApiArtifact);
const committed = await fs.readFile(artifact, "utf8");
const generated = serializeOpenApiDocument();

if (committed !== generated) {
  console.error(`Contract drift detected — ${path.relative(process.cwd(), artifact)}`);
  process.exitCode = 1;
} else {
  console.log(`Contracts check PASS — ${path.relative(process.cwd(), artifact)} is byte-stable.`);
}
