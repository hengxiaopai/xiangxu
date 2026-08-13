import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(packageRoot, "dist");
await fs.mkdir(output, { recursive: true });

for (const file of ["tokens.css", "components.css"]) {
  await fs.copyFile(path.join(packageRoot, "src", file), path.join(output, file));
}

const tokenSource = await fs.readFile(path.join(packageRoot, "src", "tokens.css"), "utf8");
const customMedia = new Map(
  [...tokenSource.matchAll(/@custom-media\s+(--xx-[a-z0-9-]+)\s+\(([^)]+)\);/gu)]
    .map((match) => [match[1], match[2]]),
);
const responsiveSource = await fs.readFile(path.join(packageRoot, "src", "daily-loop-responsive.css"), "utf8");
const responsiveOutput = responsiveSource.replace(/@media\s+\((--xx-[a-z0-9-]+)\)/gu, (_, name) => {
  const query = customMedia.get(name);
  if (query === undefined) throw new Error(`Unknown responsive token: ${name}`);
  return `@media (${query})`;
});
if (/@media\s+\(--xx-/u.test(responsiveOutput)) throw new Error("Unexpanded responsive token remains");
await fs.writeFile(path.join(output, "daily-loop-responsive.css"), responsiveOutput, "utf8");

console.log("UI build assets PASS — tokens/components copied and responsive media tokens expanded.");
