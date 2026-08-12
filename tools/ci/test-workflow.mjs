import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "../..");
const checker = path.join(toolDirectory, "check-workflow.mjs");
const negativeFixture = path.join(toolDirectory, "fixtures/invalid-ci.yml");

function run(workflow) {
  const result = spawnSync(process.execPath, [checker, "--workflow", workflow, "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`CI checker did not return JSON: ${result.stderr || result.stdout}`);
  }
  return { report, status: result.status };
}

const real = run(path.join(repositoryRoot, ".github/workflows/ci.yml"));
if (real.status !== 0 || !real.report.ok) {
  throw new Error(`Real CI workflow must pass: ${JSON.stringify(real.report.violations)}`);
}

const negative = run(negativeFixture);
if (negative.status !== 1 || negative.report.ok) throw new Error("Negative CI fixture must fail with exit code 1");
const expectedCodes = new Set([
  "continue-on-error",
  "forbidden-trigger",
  "npm-install",
  "unpinned-action",
  "write-permission",
]);
const actualCodes = new Set(negative.report.violations.map((violation) => violation.code));
const missingCodes = [...expectedCodes].filter((code) => !actualCodes.has(code));
if (missingCodes.length) throw new Error(`Negative CI fixture missed: ${missingCodes.join(", ")}`);

console.log(
  `CI policy self-test PASS — real exit ${real.status}; negative exit ${negative.status}; ${negative.report.violations.length} expected violation records.`,
);
