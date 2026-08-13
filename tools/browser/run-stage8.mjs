import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { migrateDatabase, waitForStableDatabase } from "../../packages/infrastructure/scripts/database.mjs";
import {
  composeDownWithVolumes,
  composeUp,
  createRunContext,
  removeRunContext,
} from "../../packages/infrastructure/scripts/runtime.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const httpPort = Number.parseInt(process.env.XIANGXU_STAGE8_HTTP_PORT ?? "43117", 10);
const baseUrl = `http://127.0.0.1:${httpPort}`;
const updateSnapshots = process.argv.includes("--update-snapshots");

if (process.version !== "v24.19.0") {
  throw new Error(`Stage 8 requires Node v24.19.0 exactly; current runtime is ${process.version}`);
}

if (!existsSync(chromium.executablePath())) {
  throw new Error("Approved Playwright Chromium is not installed. Audit provenance, then run: pnpm exec playwright install chromium");
}
for (const artifact of ["apps/web/.next/BUILD_ID", "apps/worker/dist/proposal-processor.js"]) {
  if (!existsSync(path.join(repositoryRoot, artifact))) {
    throw new Error(`Missing production build artifact ${artifact}. Run pnpm web:build and pnpm worker:build explicitly before browser:verify.`);
  }
}

await run(process.execPath, [path.join(repositoryRoot, "tools/browser/check-stage8-a11y.mjs")]);
process.env.XIANGXU_STAGE5_REDIS_TEST_PORT ??= "56379";
const context = await createRunContext();
const readyFile = path.join(context.temporaryRoot, "stage8-runtime.ready");
const stopFile = path.join(context.temporaryRoot, "stage8-runtime.stop");
const nextRestartSignal = path.join(context.temporaryRoot, "stage8-next-restart.signal");
const nextRestartReady = path.join(context.temporaryRoot, "stage8-next-restart.ready");
let next;
let runtime;
let monitorActive = false;
let monitorPromise = Promise.resolve();

try {
  composeDownWithVolumes(context);
  composeUp(context, ["postgres", "redis"]);
  await waitForStableDatabase(context.databaseUrl);
  await migrateDatabase(context.databaseUrl);
  await migrateDatabase(context.databaseUrl);

  runtime = spawn(process.execPath, [
    path.join(repositoryRoot, "node_modules/vitest/vitest.mjs"),
    "run",
    "--no-file-parallelism",
    "src/postgres/stage8-browser-runtime.integration.test.ts",
  ], {
    cwd: path.join(repositoryRoot, "packages/infrastructure"),
    env: {
      ...process.env,
      DATABASE_URL: context.databaseUrl,
      REDIS_URL: context.redisUrl,
      XIANGXU_STAGE8_RUNTIME_READY: readyFile,
      XIANGXU_STAGE8_RUNTIME_STOP: stopFile,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  await waitForFile(readyFile, runtime, "dispatcher/worker");

  next = startNext(context);
  await waitForHttp(next);
  monitorActive = true;
  monitorPromise = monitorNextRestarts();

  const playwrightArgs = [
    path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
    "test",
    "--config",
    path.join(repositoryRoot, "playwright.config.mjs"),
  ];
  if (updateSnapshots) playwrightArgs.push("--update-snapshots");
  if (process.env.XIANGXU_STAGE8_PLAYWRIGHT_GREP !== undefined) {
    playwrightArgs.push("--grep", process.env.XIANGXU_STAGE8_PLAYWRIGHT_GREP);
  }
  await run(process.execPath, playwrightArgs, {
    env: {
      ...process.env,
      DATABASE_URL: context.databaseUrl,
      REDIS_URL: context.redisUrl,
      XIANGXU_STAGE8_HTTP_PORT: String(httpPort),
      XIANGXU_STAGE8_NEXT_RESTART_SIGNAL: nextRestartSignal,
      XIANGXU_STAGE8_NEXT_RESTART_READY: nextRestartReady,
    },
  });
} finally {
  monitorActive = false;
  await monitorPromise;
  if (runtime !== undefined && runtime.exitCode === null) {
    await writeFile(stopFile, "stop\n", "utf8").catch(() => undefined);
    await stop(runtime, 10_000);
  }
  if (next !== undefined && next.exitCode === null) await stop(next, 10_000);
  try {
    composeDownWithVolumes(context);
  } finally {
    await removeRunContext(context);
  }
}

console.log(`Stage 8 Chromium browser verification PASS${updateSnapshots ? " — reviewed baseline update mode" : ""}.`);

function startNext(runContext) {
  return spawn(process.execPath, [
    path.join(repositoryRoot, "apps/web/node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(httpPort),
  ], {
    cwd: path.join(repositoryRoot, "apps/web"),
    env: {
      ...process.env,
      DATABASE_URL: runContext.databaseUrl,
      REDIS_URL: runContext.redisUrl,
      XIANGXU_RUNTIME_PROFILE: "test",
      XIANGXU_DEV_SESSION_ENABLED: "1",
      XIANGXU_SSE_POLL_MS: "25",
      XIANGXU_SSE_HEARTBEAT_MS: "250",
      XIANGXU_SSE_REPLAY_LIMIT: "100",
    },
    stdio: "inherit",
    windowsHide: true,
  });
}

async function monitorNextRestarts() {
  while (monitorActive) {
    if (existsSync(nextRestartSignal)) {
      await rm(nextRestartSignal, { force: true });
      await rm(nextRestartReady, { force: true });
      if (next !== undefined && next.exitCode === null) await stop(next, 10_000);
      next = startNext(context);
      await waitForHttp(next);
      await writeFile(nextRestartReady, "ready\n", "utf8");
    }
    await delay(50);
  }
}

async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  const status = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
  if (status !== 0) throw new Error(`${path.basename(command)} ${args.join(" ")} failed with exit ${status}`);
}

async function waitForFile(file, child, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (existsSync(file)) return;
    if (child.exitCode !== null) throw new Error(`${label} exited before readiness with ${child.exitCode}`);
    await delay(100);
  }
  throw new Error(`${label} did not become ready within 30 seconds`);
}

async function waitForHttp(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next production server exited before readiness with ${child.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Continue until the bounded readiness deadline.
    }
    await delay(200);
  }
  throw new Error("Next production server did not become ready within 30 seconds");
}

async function stop(child, timeout) {
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(timeout).then(() => false),
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGKILL");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
