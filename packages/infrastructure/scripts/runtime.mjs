import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { assertStage5LocalConfig, readInfrastructureConfig } from "./config.mjs";

export const PROJECT_NAME = "xiangxu-stage5";
export const REBUILD_CONFIRMATION = "--confirm-xiangxu-stage5";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const composeFile = path.join(repositoryRoot, "compose.yaml");
const expectedVolume = `${PROJECT_NAME}_postgres_data`;

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
    timeout: options.timeout ?? 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status}: ${result.stderr || result.stdout || "no output"}`,
    );
  }
  return options.capture ? result.stdout.trim() : "";
}

export async function createRunContext() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "xiangxu-stage5-"));
  const password = `stage5-${randomUUID()}`;
  const envFile = path.join(temporaryRoot, "compose.env");
  const requestedRedisPort = process.env.XIANGXU_STAGE5_REDIS_TEST_PORT ?? "6379";
  if (!(requestedRedisPort === "6379" || requestedRedisPort === "56379")) {
    throw new Error("XIANGXU_STAGE5_REDIS_TEST_PORT must be 6379 or the reviewed local fallback 56379");
  }
  const values = {
    XIANGXU_STAGE5_POSTGRES_DB: "xiangxu_stage5",
    XIANGXU_STAGE5_POSTGRES_PASSWORD: password,
    XIANGXU_STAGE5_POSTGRES_PORT: "55432",
    XIANGXU_STAGE5_POSTGRES_USER: "xiangxu_stage5",
    XIANGXU_STAGE5_REDIS_PORT: requestedRedisPort,
  };
  await writeFile(
    envFile,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  const databaseUrl = `postgresql://${values.XIANGXU_STAGE5_POSTGRES_USER}:${password}@127.0.0.1:55432/${values.XIANGXU_STAGE5_POSTGRES_DB}`;
  const redisUrl = `redis://127.0.0.1:${requestedRedisPort}/0`;
  const config = readInfrastructureConfig({ DATABASE_URL: databaseUrl, REDIS_URL: redisUrl });
  assertStage5LocalConfig(config);
  return { ...config, envFile, temporaryRoot };
}

function composeArgs(context, args) {
  return ["compose", "--project-name", PROJECT_NAME, "--env-file", context.envFile, "-f", composeFile, ...args];
}

export function composeUp(context, services = []) {
  run("docker", composeArgs(context, ["up", "-d", "--wait", "--wait-timeout", "60", ...services]));
}

function projectVolumes() {
  const output = run(
    "docker",
    ["volume", "ls", "--filter", `label=com.docker.compose.project=${PROJECT_NAME}`, "--format", "{{.Name}}"],
    { capture: true },
  );
  return output ? output.split(/\r?\n/u).filter(Boolean) : [];
}

export function assertDestructiveProjectIdentity(context) {
  assertStage5LocalConfig(context);
  for (const volume of projectVolumes()) {
    if (volume !== expectedVolume) {
      throw new Error(`Refusing to remove unexpected Docker volume ${volume}`);
    }
    const projectLabel = run(
      "docker",
      ["volume", "inspect", volume, "--format", "{{index .Labels \"com.docker.compose.project\"}}"],
      { capture: true },
    );
    if (projectLabel !== PROJECT_NAME) throw new Error(`Refusing volume with project label ${projectLabel}`);
  }
}

export function composeDownWithVolumes(context) {
  assertDestructiveProjectIdentity(context);
  run("docker", composeArgs(context, ["down", "--volumes", "--remove-orphans"]));
}

export function collectContainerEvidence(context) {
  const evidence = {};
  for (const service of ["postgres", "redis"]) {
    const id = run("docker", composeArgs(context, ["ps", "-q", service]), { capture: true });
    if (!id) continue;
    evidence[service] = run(
      "docker",
      ["inspect", id, "--format", "image={{.Config.Image}} imageId={{.Image}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}"],
      { capture: true },
    );
  }
  return evidence;
}

export function requireDestructiveConfirmation(args) {
  if (!args.includes(REBUILD_CONFIRMATION)) {
    throw new Error(`Destructive Stage 5 smoke requires ${REBUILD_CONFIRMATION}`);
  }
}

export async function removeRunContext(context) {
  const resolved = path.resolve(context.temporaryRoot);
  const temporaryBase = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${temporaryBase}${path.sep}`) || !path.basename(resolved).startsWith("xiangxu-stage5-")) {
    throw new Error(`Refusing to remove unexpected temporary path ${resolved}`);
  }
  await rm(resolved, { force: true, recursive: true });
}
