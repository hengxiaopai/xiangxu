import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(packageRoot, "dist");
await fs.mkdir(output, { recursive: true });

for (const file of ["tokens.css", "components.css"]) {
  await fs.copyFile(path.join(packageRoot, "src", file), path.join(output, file));
}

console.log("UI build assets PASS — token and component CSS copied.");
