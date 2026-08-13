import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const roots = [path.join(repositoryRoot, "apps/web/src"), path.join(repositoryRoot, "packages/ui/src")];
const files = [];

for (const root of roots) await collect(root);

const failures = [];
let buttonCount = 0;
let inputCount = 0;
for (const file of files) {
  const source = await readFile(file, "utf8");
  inspect(file, source);
}

if (failures.length > 0) {
  console.error("Stage 8 bounded static accessibility scan FAIL:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Stage 8 bounded static accessibility scan PASS — ${files.length} TSX files, ${buttonCount} native buttons, ${inputCount} form controls; positive tabindex/noninteractive click/image alt/obvious name-label/landmark/global invalidation checks passed.`);
}

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else if (entry.isFile() && absolute.endsWith(".tsx")) files.push(absolute);
  }
}

function inspect(file, source) {
  const relative = path.relative(repositoryRoot, file);
  if (/tabIndex\s*=\s*(?:\{\s*)?["']?[1-9]/u.test(source)) {
    failures.push(`${relative}: positive tabindex`);
  }
  if (/<(?:div|span|p|section|article)\b[^>]*\bonClick\s*=/u.test(source)) {
    failures.push(`${relative}: click handler on a noninteractive element`);
  }
  for (const image of source.matchAll(/<img\b[^>]*>/gu)) {
    if (!/\balt\s*=/u.test(image[0])) failures.push(`${relative}: img without alt`);
  }
  for (const button of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)) {
    buttonCount += 1;
    const [, attributes = "", content = ""] = button;
    if (!/\baria-(?:label|labelledby)\s*=/u.test(attributes) && content.replace(/<[^>]+>/gu, "").trim().length === 0) {
      failures.push(`${relative}: native button without an obvious accessible name`);
    }
  }
  for (const control of source.matchAll(/<(input|textarea|select)\b([^>]*)>/gu)) {
    inputCount += 1;
    const attributes = control[2] ?? "";
    const before = source.slice(Math.max(0, (control.index ?? 0) - 500), control.index);
    const wrappedByLabel = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
    const named = /\baria-(?:label|labelledby)\s*=/u.test(attributes);
    const id = /\bid\s*=\s*["']([^"']+)["']/u.exec(attributes)?.[1];
    const explicitLabel = id !== undefined && new RegExp(`htmlFor\\s*=\\s*["']${escapeRegex(id)}["']`, "u").test(source);
    if (!wrappedByLabel && !named && !explicitLabel) failures.push(`${relative}: ${control[1]} without an obvious label/name`);
  }
  const mainCount = [...source.matchAll(/<main\b/gu)].length;
  if (mainCount > 1) failures.push(`${relative}: multiple obvious main landmarks in one component`);
  if (/invalidateQueries\s*\(\s*(?:\)|\{\s*\})/u.test(source)) {
    failures.push(`${relative}: unfiltered invalidateQueries`);
  }
  if (/outline\s*:\s*none/u.test(source)) failures.push(`${relative}: outline:none without reviewable equivalent`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
