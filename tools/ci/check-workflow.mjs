import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "../..");
const approvedActions = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["pnpm/setup", "84cb39b217b10273981911c288cd62326dc7c6d2"],
]);

function parseArguments(args) {
  const options = { json: false, workflow: path.join(repositoryRoot, ".github/workflows/ci.yml") };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--workflow") {
      const value = args[index + 1];
      if (!value) throw new Error("--workflow requires a path");
      options.workflow = path.resolve(repositoryRoot, value);
      index += 1;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

const options = parseArguments(process.argv.slice(2));
const source = await fs.readFile(options.workflow, "utf8");
const semanticSource = source
  .split(/\r?\n/u)
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");
const violations = [];

function add(code, message, offset = 0) {
  violations.push({ code, line: lineNumber(source, offset), message });
}

function requireMatch(code, pattern, message) {
  if (!pattern.test(semanticSource)) add(code, message);
}

function forbid(code, pattern, message) {
  const match = pattern.exec(semanticSource);
  if (match) add(code, message, match.index);
}

const actionCounts = new Map([...approvedActions.keys()].map((action) => [action, 0]));
for (const match of semanticSource.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*$/gmu)) {
  const value = match[1];
  const actionMatch = /^([^@]+)@([0-9a-f]{40})$/u.exec(value);
  if (!actionMatch) {
    add("unpinned-action", `Action must use a full 40-character SHA: ${value}`, match.index);
    continue;
  }
  const [, action, sha] = actionMatch;
  if (!approvedActions.has(action)) {
    add("unapproved-action", `Action is not approved: ${action}`, match.index);
    continue;
  }
  if (approvedActions.get(action) !== sha) {
    add("wrong-action-sha", `Action ${action} uses an unapproved SHA`, match.index);
    continue;
  }
  actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
}
for (const [action, count] of actionCounts) {
  if (count !== 1) add("action-count", `Expected exactly one ${action} step; found ${count}`);
}

const runnerMatches = [...semanticSource.matchAll(/^\s*runs-on:\s*(\S+)\s*$/gmu)];
if (runnerMatches.length !== 1 || runnerMatches[0]?.[1] !== "ubuntu-24.04") {
  add("runner", `Expected one ubuntu-24.04 runner; found ${runnerMatches.map((match) => match[1]).join(", ") || "none"}`);
}
requireMatch("permissions", /^permissions:\s*\n\s{2}contents:\s*read\s*$/mu, "Workflow permissions must be contents: read");
forbid("write-permission", /^\s*[a-z][a-z-]*:\s*write\s*$/gimu, "Write permissions are forbidden");
forbid(
  "forbidden-trigger",
  /^\s*(?:pull_request_target|workflow_run|schedule|repository_dispatch|deployment|release):/gmu,
  "Privileged or expanded trigger is forbidden",
);
forbid("continue-on-error", /^\s*(?:-\s*)?continue-on-error:\s*true\s*$/gimu, "Required steps cannot continue on error");
forbid("workflow-secret", /\$\{\{\s*secrets\.|^\s*secrets:\s*$/gimu, "Workflow secrets are forbidden");
forbid("service-container", /^\s*services:\s*$/gmu, "Workflow service containers are forbidden");
forbid("failure-mask", /\|\|\s*true|continue-on-error:\s*true/giu, "Failure masking is forbidden");
forbid("shell-installer", /curl\b[^\n|]*\|\s*(?:ba)?sh|wget\b[^\n|]*\|\s*(?:ba)?sh/giu, "Shell download-and-execute is forbidden");
forbid("npm-install", /\bnpm\s+(?:install|ci)\b/giu, "npm install commands are forbidden");
forbid("install-policy", /pnpm\s+(?:update|install\s+--no-frozen-lockfile)\b/giu, "Non-frozen pnpm install policy is forbidden");
forbid("skip-infrastructure", /\b(?:SKIP_DB|SKIP_REDIS|SKIP_INFRA|CI_FAST_MODE)\b/gu, "Infrastructure verification cannot be skipped");

for (const [code, pattern, message] of [
  ["push-main", /^\s*push:\s*\n\s{4}branches:\s*\n\s{6}-\s*main\s*$/mu, "push must target main"],
  ["pull-request", /^\s*pull_request:\s*$/mu, "pull_request trigger is required"],
  ["workflow-dispatch", /^\s*workflow_dispatch:\s*$/mu, "workflow_dispatch trigger is required"],
  ["checkout-credentials", /^\s*persist-credentials:\s*false\s*$/mu, "checkout credentials must not persist"],
  ["pnpm-version", /^\s*version:\s*11\.21\.0\s*$/mu, "pnpm/setup version must be exact"],
  ["node-runtime", /^\s*runtime:\s*node@24\.19\.0\s*$/mu, "pnpm/setup runtime must be exact"],
  ["setup-install", /^\s*install:\s*false\s*$/mu, "pnpm/setup automatic install must be disabled"],
  ["setup-cache", /^\s*cache:\s*false\s*$/mu, "pnpm/setup cache must be disabled"],
  ["timeout", /^\s*timeout-minutes:\s*30\s*$/mu, "verify job timeout must be 30 minutes"],
  ["concurrency", /^\s*cancel-in-progress:\s*true\s*$/mu, "stale branch runs must be cancellable"],
  ["runtime-assertion", /test "\$node_version" = "v24\.19\.0"/u, "Node version must fail closed"],
  ["pnpm-assertion", /test "\$pnpm_version" = "11\.21\.0"/u, "pnpm version must fail closed"],
  ["registry-assertion", /test "\$registry" = "https:\/\/registry\.npmjs\.org\/"/u, "official registry must fail closed"],
  ["fresh-workspace", /test ! -e node_modules/u, "node_modules must be absent before install"],
  ["lock-hash", /sha256sum pnpm-lock\.yaml/u, "lockfile SHA-256 must be recorded"],
  ["lifecycle-assertion", /pnpm ignored-builds/u, "post-install lifecycle status must be checked"],
  ["docker-version", /^\s*docker version\s*$/mu, "Docker daemon diagnostics are required"],
  ["compose-version", /^\s*docker compose version\s*$/mu, "Docker Compose diagnostics are required"],
  ["container-cleanup", /docker ps -aq --filter 'label=com\.docker\.compose\.project=xiangxu-stage5'/u, "container residue must be checked"],
  ["volume-cleanup", /docker volume ls -q --filter 'label=com\.docker\.compose\.project=xiangxu-stage5'/u, "volume residue must be checked"],
]) requireMatch(code, pattern, message);

const installMatches = [...semanticSource.matchAll(/^\s*run:\s*pnpm install --frozen-lockfile\s*$/gmu)];
if (installMatches.length !== 1) add("canonical-install", `Expected one exact frozen install command; found ${installMatches.length}`);
const verifyMatches = [...semanticSource.matchAll(/^\s*run:\s*pnpm verify\s*$/gmu)];
if (verifyMatches.length !== 1) add("canonical-verify", `Expected one exact pnpm verify command; found ${verifyMatches.length}`);
const freshIndex = semanticSource.indexOf("test ! -e node_modules");
const installIndex = semanticSource.indexOf("run: pnpm install --frozen-lockfile");
if (freshIndex < 0 || installIndex < 0 || freshIndex > installIndex) add("fresh-before-install", "Fresh workspace assertion must precede install");

const report = {
  ok: violations.length === 0,
  workflow: path.relative(repositoryRoot, options.workflow),
  violations,
};
if (options.json) console.log(JSON.stringify(report));
else if (report.ok) console.log(`CI workflow policy PASS — ${report.workflow}; 2 approved SHA-pinned Actions.`);
else {
  console.error(`CI workflow policy FAIL — ${violations.length} violation(s).`);
  for (const violation of violations) console.error(`[${violation.code}] line ${violation.line}: ${violation.message}`);
}
if (!report.ok) process.exitCode = 1;
