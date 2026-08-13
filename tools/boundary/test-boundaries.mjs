import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "../..");
const checker = path.join(toolDirectory, "check-boundaries.mjs");
const fixtureRoot = path.join(repositoryRoot, "packages/testing/fixtures/boundary");

function runFixture(name) {
  const result = spawnSync(process.execPath, [checker, "--root", path.join(fixtureRoot, name), "--allow-partial", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${name} fixture did not return JSON: ${result.stderr || result.stdout}`);
  }
  return { status: result.status, report, stderr: result.stderr };
}

const positive = runFixture("positive");
if (positive.status !== 0 || !positive.report.ok) {
  throw new Error(`Positive fixture must pass: ${JSON.stringify(positive.report.violations)}`);
}

const negative = runFixture("negative");
if (negative.status !== 1 || negative.report.ok) {
  throw new Error("Negative fixture must fail with checker exit code 1");
}

const expectedCodes = new Set([
  "cross-package-relative-import",
  "client-reaches-server-composition",
  "deep-import",
  "forbidden-workspace-dependency",
  "external-dependency-not-allowed",
  "external-import-not-allowed",
  "production-depends-on-testing",
  "runtime-import-on-type-only-edge",
  "source-scoped-workspace-import",
  "undeclared-workspace-import",
  "workspace-cycle",
]);
const actualCodes = new Set(negative.report.violations.map((violation) => violation.code));
const missingCodes = [...expectedCodes].filter((code) => !actualCodes.has(code));
if (missingCodes.length) throw new Error(`Negative fixture missed: ${missingCodes.join(", ")}`);

const expectedEdges = [
  ["@xiangxu/domain", "@xiangxu/application"],
  ["@xiangxu/domain", "@xiangxu/infrastructure"],
  ["@xiangxu/application", "@xiangxu/infrastructure"],
  ["@xiangxu/ui", "@xiangxu/infrastructure"],
];
for (const [source, target] of expectedEdges) {
  const found = negative.report.violations.some(
    (violation) => violation.code === "forbidden-workspace-dependency" && violation.package === source && violation.target === target,
  );
  if (!found) throw new Error(`Negative fixture did not reject ${source} -> ${target}`);
}

for (const [code, fileFragment] of [
  ["source-scoped-workspace-import", "apps/web/src/server/other.ts"],
  ["client-reaches-server-composition", "apps/web/src/client-entry.ts"],
  ["deep-import", "apps/web/src/server/composition/deep.ts"],
]) {
  const found = negative.report.violations.some(
    (violation) => violation.code === code && violation.file?.replaceAll("\\", "/").includes(fileFragment),
  );
  if (!found) throw new Error(`Negative fixture did not prove ${code} for ${fileFragment}`);
}

for (const source of ["@xiangxu/domain", "@xiangxu/ui"]) {
  const found = negative.report.violations.some(
    (violation) =>
      violation.code === "runtime-import-on-type-only-edge" &&
      violation.package === source &&
      violation.target === "@xiangxu/contracts",
  );
  if (!found) throw new Error(`Negative fixture did not reject runtime ${source} -> @xiangxu/contracts`);
}

for (const [source, target] of [
  ["@xiangxu/domain", "zod"],
  ["@xiangxu/application", "react"],
  ["@xiangxu/domain", "drizzle-orm"],
  ["@xiangxu/domain", "pg"],
  ["@xiangxu/domain", "ioredis"],
  ["@xiangxu/domain", "bullmq"],
  ["@xiangxu/application", "drizzle-orm"],
  ["@xiangxu/application", "bullmq"],
  ["@xiangxu/web", "pg"],
  ["@xiangxu/web", "bullmq"],
  ["@xiangxu/ui", "pg"],
  ["@xiangxu/ui", "ioredis"],
  ["@xiangxu/ui", "bullmq"],
]) {
  const found = negative.report.violations.some(
    (violation) => violation.code === "external-import-not-allowed" && violation.package === source && violation.specifier === target,
  );
  if (!found) throw new Error(`Negative fixture did not reject ${source} -> ${target}`);
}

const nonTestVitest = negative.report.violations.some(
  (violation) =>
    violation.code === "external-import-not-allowed" &&
    violation.package === "@xiangxu/domain" &&
    violation.specifier === "vitest" &&
    violation.file?.replaceAll("\\", "/").includes("packages/domain/src/test-helper.ts"),
);
if (!nonTestVitest) throw new Error("Negative fixture did not reject Vitest outside an approved *.test.ts source scope");

console.log(`Boundary self-test PASS — positive exit ${positive.status}; negative exit ${negative.status}; ${negative.report.violations.length} expected violation records.`);
