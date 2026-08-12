import fs from "node:fs/promises";
import path from "node:path";

import { openApiArtifact, serializeOpenApiDocument } from "./openapi.mjs";

await fs.mkdir(path.dirname(openApiArtifact), { recursive: true });
await fs.writeFile(openApiArtifact, serializeOpenApiDocument(), "utf8");
console.log(`Contracts generation PASS — ${path.relative(process.cwd(), openApiArtifact)}`);
