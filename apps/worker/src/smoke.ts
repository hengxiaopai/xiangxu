import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runFakeJob } from "./fake-job.js";
import { ProposalGenerationProcessor } from "./proposal-processor.js";

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve a smoke port");
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForHealth(origin: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) return await response.json();
    } catch {
      // The process may still be binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Worker health did not become ready");
}

async function main() {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const entry = fileURLToPath(new URL("./index.js", import.meta.url));
  const child = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: { ...process.env, WORKER_PORT: String(port), XIANGXU_WORKER_SMOKE_IPC: "1" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  if (!child.stdout || !child.stderr) throw new Error("Worker smoke pipes were not created");
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  try {
    assert.deepEqual(await waitForHealth(origin), { status: "ok" });
    assert.deepEqual(runFakeJob("stage-3-smoke"), { smokeId: "stage-3-smoke", status: "completed" });
    const proposalIntent = {
      outboxEventId: "0198f1a0-1000-7000-8000-000000000001",
      outboxSequence: "9007199254740993",
      commandId: "0198f1a0-1000-7000-8000-000000000001",
      captureId: "0198f1a0-1000-7000-8000-000000000002",
      correlationId: "0198f1a0-1000-7000-8000-000000000003",
    };
    let applicationIntent: unknown;
    const proposalResult = await new ProposalGenerationProcessor({
      generate: async (intent) => {
        applicationIntent = intent;
        return { status: 202, proposalId: "0198f1a0-1000-7000-8000-000000000004" };
      },
    }).process(proposalIntent);
    assert.deepEqual(applicationIntent, proposalIntent);
    assert.deepEqual(proposalResult, { status: 202, proposalId: "0198f1a0-1000-7000-8000-000000000004" });
    assert.equal("rawText" in proposalIntent, false);
    await new Promise<void>((resolve, reject) => {
      child.send("SIGTERM", (error) => (error ? reject(error) : resolve()));
    });
    const result = await Promise.race([
      exited,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Worker did not shut down")), 5_000)),
    ]);
    assert.equal(result.code, 0, output);
    assert.match(output, /WORKER_SHUTDOWN SIGTERM/);
    console.log(`Worker smoke PASS — health 200; fake job and Proposal Application processor completed; graceful shutdown exit ${result.code}.`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
