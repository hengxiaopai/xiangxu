import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "../..");
const artifactDirectory = path.join(repositoryRoot, "artifacts/browser/stage7");
const manifestPath = path.join(artifactDirectory, "manifest.json");
const expectedFilenames = new Set([
  "login-desktop-dark.png",
  "login-desktop-light.png",
  "login-mobile-dark.png",
  "login-mobile-light.png",
  "today-desktop-dark.png",
  "today-desktop-light.png",
  "today-mobile-dark.png",
  "today-mobile-light.png",
]);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases) || manifest.cases.length !== 8) {
  throw new Error("Stage 7 manifest must use schema version 1 and contain exactly eight cases");
}

const actualFilenames = new Set(manifest.cases.map((entry) => entry.filename));
if (
  actualFilenames.size !== expectedFilenames.size ||
  [...expectedFilenames].some((filename) => !actualFilenames.has(filename))
) {
  throw new Error("Stage 7 manifest filenames do not match the required eight-state matrix");
}

for (const entry of manifest.cases) {
  const png = await readFile(path.join(artifactDirectory, entry.filename));
  const actualHash = createHash("sha256").update(png).digest("hex");
  if (actualHash !== entry.sha256) throw new Error(`SHA-256 mismatch for ${entry.filename}`);
  if (
    entry.httpStatus !== 200 ||
    entry.consoleErrorCount !== 0 ||
    entry.pageErrorCount !== 0 ||
    entry.failedRequestCount !== 0 ||
    entry.horizontalOverflow !== false
  ) {
    throw new Error(`Browser assertion failed for ${entry.filename}`);
  }
}

const keyboard = JSON.parse(await readFile(path.join(artifactDirectory, "keyboard-enter.json"), "utf8"));
if (
  keyboard.acceptance41 !== "PASS" ||
  keyboard.automation?.inputMethod !== "browser-level CUA keypress" ||
  keyboard.sequence?.beforeEnter?.href !== "/login" ||
  keyboard.sequence?.afterEnter?.pathname !== "/login" ||
  keyboard.disabledLoginButton?.authenticationRequestCount !== 0
) {
  throw new Error("Trusted Enter evidence is incomplete");
}

console.log("Stage 7 browser evidence PASS — 8 screenshots and trusted Enter evidence verified.");
