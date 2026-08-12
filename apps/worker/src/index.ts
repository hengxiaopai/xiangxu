import process from "node:process";

import { startWorkerServer } from "./server.js";

function configuredPort(): number {
  const value = Number.parseInt(process.env.WORKER_PORT ?? "4311", 10);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) throw new Error("WORKER_PORT must be a valid TCP port");
  return value;
}

async function main() {
  const server = await startWorkerServer(configuredPort());
  console.log(`WORKER_READY ${server.origin}`);

  let closing = false;
  async function shutdown(signal: "SIGINT" | "SIGTERM") {
    if (closing) return;
    closing = true;
    console.log(`WORKER_SHUTDOWN ${signal}`);
    await server.close();
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  if (process.env.XIANGXU_WORKER_SMOKE_IPC === "1") {
    process.once("message", (message) => {
      if (message !== "SIGTERM") return;
      process.disconnect?.();
      process.emit("SIGTERM");
    });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
