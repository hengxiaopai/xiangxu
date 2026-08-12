import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "../..");
const evidencePath = path.join(repositoryRoot, "artifacts/browser/stage7/keyboard-enter.json");
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));

if (
  evidence.acceptance41 !== "PASS" ||
  evidence.sequence?.firstTab?.href !== "/app/today" ||
  evidence.sequence?.beforeEnter?.tag !== "A" ||
  evidence.sequence?.beforeEnter?.text !== "Login shell" ||
  evidence.sequence?.beforeEnter?.href !== "/login" ||
  evidence.sequence?.afterEnter?.pathname !== "/login" ||
  evidence.sequence?.afterEnter?.httpStatus !== 200 ||
  evidence.shiftTab?.reverse?.href !== "/app/today" ||
  evidence.disabledLoginButton?.afterTab?.tag === "BUTTON" ||
  evidence.disabledLoginButton?.disabled !== true ||
  evidence.disabledLoginButton?.authenticationRequestCount !== 0
) {
  throw new Error("Trusted Stage 7 keyboard evidence is incomplete");
}

console.log("Stage 7 browser keyboard check PASS — real Tab, Shift+Tab, and Enter activation verified.");
