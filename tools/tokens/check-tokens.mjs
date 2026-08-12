import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "../..");
const tokenSource = path.join(repositoryRoot, "packages/ui/src/tokens.css");
const roots = [path.join(repositoryRoot, "apps/web/src"), path.join(repositoryRoot, "packages/ui/src")];
const extensions = new Set([".css", ".ts", ".tsx"]);
const rawColor = /#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\s*\(/giu;
const rawLength = /:\s*-?(?:\d+\.)?\d+(?:px|rem|em)\b/giu;
const inlineStyle = /\bstyle\s*=\s*\{/gu;
const tokenDefinition = /--xx-[a-z0-9-]+\s*:/giu;

async function collectFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(target)));
    else if (extensions.has(path.extname(entry.name))) files.push(target);
  }
  return files;
}

function lineOf(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function recordMatches(violations, file, source, pattern, code) {
  for (const match of source.matchAll(pattern)) {
    violations.push({ code, file: path.relative(repositoryRoot, file), line: lineOf(source, match.index ?? 0), value: match[0] });
  }
}

const violations = [];
const tokenCss = await fs.readFile(tokenSource, "utf8");
for (const marker of ["/* Primitive tokens", "/* Semantic tokens", "/* Component tokens"]) {
  if (!tokenCss.includes(marker)) violations.push({ code: "missing-token-layer", file: path.relative(repositoryRoot, tokenSource), value: marker });
}

const semanticStart = tokenCss.indexOf("/* Semantic tokens");
if (semanticStart >= 0) {
  const governedLayers = tokenCss.slice(semanticStart);
  recordMatches(violations, tokenSource, governedLayers, rawColor, "raw-color-outside-primitive-layer");
  recordMatches(violations, tokenSource, governedLayers, rawLength, "raw-length-outside-primitive-layer");
}

let filesScanned = 0;
for (const root of roots) {
  for (const file of await collectFiles(root)) {
    filesScanned += 1;
    if (file === tokenSource) continue;
    const source = await fs.readFile(file, "utf8");
    recordMatches(violations, file, source, rawColor, "raw-color-in-consumer");
    recordMatches(violations, file, source, rawLength, "raw-length-in-consumer");
    if (path.extname(file) !== ".css") recordMatches(violations, file, source, inlineStyle, "inline-style-in-consumer");
    if (file.startsWith(path.join(repositoryRoot, "apps/web"))) {
      recordMatches(violations, file, source, tokenDefinition, "parallel-web-token-definition");
    }
  }
}

if (violations.length) {
  console.error(`Token static check FAIL — ${violations.length} violation(s).`);
  for (const violation of violations) {
    console.error(`[${violation.code}] ${violation.file}:${violation.line ?? 1} ${violation.value}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Token static check PASS — ${filesScanned} files; primitive raw values confined to packages/ui/src/tokens.css.`);
}
