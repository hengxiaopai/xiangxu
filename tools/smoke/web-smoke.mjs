import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.join(repositoryRoot, "apps/web");

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve a Web smoke port");
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForRoute(url, marker) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.status === 200 && body.includes(marker)) return response.status;
    } catch {
      // The production server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Route did not become ready: ${url}`);
}

async function main() {
  const port = await availablePort();
  const nextCli = path.join(webRoot, "node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: webRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));

  try {
    const origin = `http://127.0.0.1:${port}`;
    const login = await waitForRoute(`${origin}/login`, 'data-shell="login"');
    const today = await waitForRoute(`${origin}/app/today`, 'data-page="today"');
    const review = await waitForRoute(`${origin}/app/review`, 'data-page="review"');
    assert.equal(login, 200);
    assert.equal(today, 200);
    assert.equal(review, 200);
    console.log(`Web smoke PASS — /login ${login}; /app/today ${today}; /app/review ${review}; port ${port}.`);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`, { cause: error });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
    }
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
