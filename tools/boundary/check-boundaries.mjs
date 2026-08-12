import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);

function parseArguments(argv) {
  const result = { json: false, allowPartial: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") result.json = true;
    else if (value === "--allow-partial") result.allowPartial = true;
    else if (value === "--root") result.root = argv[++index];
    else if (value === "--matrix") result.matrix = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function scriptKind(file) {
  const extension = path.extname(file);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function collectSourceFiles(directory) {
  if (!(await exists(directory))) return [];
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(target)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(target);
  }
  return files;
}

async function collectWorkspaceManifests(root) {
  const manifests = [];
  for (const group of ["apps", "packages"]) {
    const groupRoot = path.join(root, group);
    if (!(await exists(groupRoot))) continue;
    for (const entry of await fs.readdir(groupRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(groupRoot, entry.name, "package.json");
      if (await exists(manifest)) manifests.push(manifest);
    }
  }
  return manifests;
}

function collectImports(source, file) {
  const imports = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
  function add(specifier, typeOnly, position) {
    imports.push({ specifier, typeOnly, line: sourceFile.getLineAndCharacterOfPosition(position).line + 1 });
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const namedBindings = clause?.namedBindings;
      const typeOnly = Boolean(
        clause?.isTypeOnly ||
          (!clause?.name &&
            namedBindings &&
            ts.isNamedImports(namedBindings) &&
            namedBindings.elements.length > 0 &&
            namedBindings.elements.every((element) => element.isTypeOnly)),
      );
      add(node.moduleSpecifier.text, typeOnly, node.getStart(sourceFile));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly = Boolean(
        node.isTypeOnly ||
          (node.exportClause &&
            ts.isNamedExports(node.exportClause) &&
            node.exportClause.elements.length > 0 &&
            node.exportClause.elements.every((element) => element.isTypeOnly)),
      );
      add(node.moduleSpecifier.text, typeOnly, node.getStart(sourceFile));
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      add(node.argument.literal.text, true, node.getStart(sourceFile));
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      add(node.arguments[0].text, false, node.getStart(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return imports;
}

function externalAllowed(specifier, allowed) {
  return allowed.some((entry) => entry === specifier || (entry.endsWith("*") && specifier.startsWith(entry.slice(0, -1))));
}

function addViolation(violations, code, record, details) {
  violations.push({ code, package: record?.name ?? null, ...details });
}

function checkManifestEdge(violations, source, targetName, details) {
  const permission = source.policy.allowedWorkspaceDependencies[targetName];
  if (!permission) {
    addViolation(violations, "forbidden-workspace-dependency", source, {
      ...details,
      target: targetName,
      message: `${source.name} cannot depend on ${targetName}`,
    });
  }
}

function checkSourceEdge(violations, source, targetName, typeOnly, details) {
  const permission = source.policy.allowedWorkspaceDependencies[targetName];
  if (!permission) {
    checkManifestEdge(violations, source, targetName, details);
  } else if (permission === "type-only" && !typeOnly) {
    addViolation(violations, "runtime-import-on-type-only-edge", source, {
      ...details,
      target: targetName,
      message: `${source.name} may import ${targetName} only with import type/export type`,
    });
  }
}

function findCycle(graph) {
  const visited = new Set();
  const active = new Set();
  const stack = [];
  function visit(node) {
    if (active.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    if (visited.has(node)) return null;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const target of graph.get(node) ?? []) {
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    stack.pop();
    active.delete(node);
    return null;
  }
  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
  const defaultRoot = path.resolve(toolDirectory, "../..");
  const root = path.resolve(args.root ?? defaultRoot);
  const matrixFile = path.resolve(args.matrix ?? path.join(defaultRoot, "tools/boundary/boundary-matrix.json"));
  const matrix = await readJson(matrixFile);
  const violations = [];
  const records = [];
  const policyEntries = Object.entries(matrix.packages);
  const configuredPaths = new Set(policyEntries.map(([, policy]) => path.normalize(policy.path)));

  for (const manifest of await collectWorkspaceManifests(root)) {
    const relativeRoot = path.relative(root, path.dirname(manifest));
    if (!configuredPaths.has(path.normalize(relativeRoot))) {
      addViolation(violations, "workspace-not-in-matrix", null, {
        file: path.relative(root, manifest),
        message: `${relativeRoot} is a workspace but is absent from the boundary matrix`,
      });
    }
  }

  for (const [name, policy] of policyEntries) {
    const packageRoot = path.join(root, policy.path);
    const manifestFile = path.join(packageRoot, "package.json");
    if (!(await exists(manifestFile))) {
      if (!args.allowPartial) addViolation(violations, "missing-workspace", null, { target: name, file: policy.path, message: `${name} is missing` });
      continue;
    }
    const manifest = await readJson(manifestFile);
    if (manifest.name !== name) {
      addViolation(violations, "workspace-name-mismatch", { name, policy }, {
        file: path.relative(root, manifestFile),
        message: `Expected ${name}, found ${String(manifest.name)}`,
      });
    }
    records.push({ name, policy, root: packageRoot, manifest, manifestFile });
  }

  const internalNames = policyEntries.map(([name]) => name).sort((left, right) => right.length - left.length);
  const graph = new Map(records.map((record) => [record.name, new Set()]));
  let filesScanned = 0;
  let manifestEdges = 0;

  for (const record of records) {
    const declared = new Set();
    for (const section of dependencySections) {
      for (const [dependency, version] of Object.entries(record.manifest[section] ?? {})) {
        declared.add(dependency);
        if (dependency.startsWith(matrix.namespace)) {
          if (!matrix.packages[dependency]) {
            addViolation(violations, "unknown-workspace-dependency", record, {
              file: path.relative(root, record.manifestFile),
              target: dependency,
              section,
              message: `${dependency} is not defined by the boundary matrix`,
            });
            continue;
          }
          manifestEdges += 1;
          graph.get(record.name)?.add(dependency);
          if (matrix.rules.requireWorkspaceProtocol && !String(version).startsWith("workspace:")) {
            addViolation(violations, "workspace-protocol-required", record, {
              file: path.relative(root, record.manifestFile),
              target: dependency,
              section,
              message: `${dependency} must use the workspace: protocol`,
            });
          }
          if (matrix.rules.forbidProductionDependingOnTesting && record.policy.kind === "production" && matrix.packages[dependency].kind === "test-only") {
            addViolation(violations, "production-depends-on-testing", record, {
              file: path.relative(root, record.manifestFile),
              target: dependency,
              section,
              message: `Production workspace ${record.name} cannot depend on test-only ${dependency}`,
            });
          }
          checkManifestEdge(violations, record, dependency, {
            file: path.relative(root, record.manifestFile),
            section,
          });
        } else if (!externalAllowed(dependency, record.policy.allowedExternalDependencies)) {
          addViolation(violations, "external-dependency-not-allowed", record, {
            file: path.relative(root, record.manifestFile),
            target: dependency,
            section,
            message: `${dependency} is not approved for ${record.name} in Stage 2`,
          });
        }
      }
    }

    const sourceInputs = await collectSourceFiles(path.join(record.root, "src"));
    for (const relativeInput of record.policy.additionalSourceInputs ?? []) {
      const file = path.join(record.root, relativeInput);
      if (await exists(file)) sourceInputs.push(file);
      else {
        addViolation(violations, "missing-additional-source-input", record, {
          file: path.relative(root, file),
          message: `Configured production input ${relativeInput} is missing`,
        });
      }
    }

    for (const file of sourceInputs) {
      filesScanned += 1;
      const source = await fs.readFile(file, "utf8");
      for (const imported of collectImports(source, file)) {
        const location = `${path.relative(root, file)}:${imported.line}`;
        if (imported.specifier.startsWith(".")) {
          const resolved = path.resolve(path.dirname(file), imported.specifier);
          const targetRecord = records.find((candidate) => candidate.name !== record.name && isInside(resolved, candidate.root));
          if (targetRecord && matrix.rules.forbidCrossPackageRelativeImports) {
            addViolation(violations, "cross-package-relative-import", record, {
              file: location,
              specifier: imported.specifier,
              target: targetRecord.name,
              message: `Relative import crosses into ${targetRecord.name}`,
            });
          }
          continue;
        }

        const targetName = internalNames.find((name) => imported.specifier === name || imported.specifier.startsWith(`${name}/`));
        if (imported.specifier.startsWith(matrix.namespace) && !targetName) {
          addViolation(violations, "unknown-workspace-import", record, {
            file: location,
            specifier: imported.specifier,
            message: `${imported.specifier} is not defined by the boundary matrix`,
          });
        } else if (targetName && targetName !== record.name) {
          if (matrix.rules.forbidDeepImports && imported.specifier !== targetName) {
            addViolation(violations, "deep-import", record, {
              file: location,
              specifier: imported.specifier,
              target: targetName,
              message: `Cross-package import must use public entry point ${targetName}`,
            });
          }
          checkSourceEdge(violations, record, targetName, imported.typeOnly, {
            file: location,
            specifier: imported.specifier,
          });
          if (matrix.rules.requireDeclaredWorkspaceImports && !declared.has(targetName)) {
            addViolation(violations, "undeclared-workspace-import", record, {
              file: location,
              specifier: imported.specifier,
              target: targetName,
              message: `${targetName} is imported but absent from all dependency sections`,
            });
          }
        } else if (!targetName && !externalAllowed(imported.specifier, record.policy.allowedExternalDependencies)) {
          addViolation(violations, "external-import-not-allowed", record, {
            file: location,
            specifier: imported.specifier,
            message: `${imported.specifier} is not approved for ${record.name} in Stage 2`,
          });
        }
      }
    }
  }

  if (matrix.rules.forbidWorkspaceCycles) {
    const cycle = findCycle(graph);
    if (cycle) addViolation(violations, "workspace-cycle", null, { cycle, message: `Workspace cycle: ${cycle.join(" -> ")}` });
  }

  violations.sort((left, right) => `${left.code}:${left.file ?? ""}:${left.package ?? ""}`.localeCompare(`${right.code}:${right.file ?? ""}:${right.package ?? ""}`));
  const result = { ok: violations.length === 0, root, packages: records.length, filesScanned, manifestEdges, violations };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else if (result.ok) console.log(`Boundary PASS — ${records.length} workspaces, ${filesScanned} source files, ${manifestEdges} manifest edges.`);
  else {
    console.error(`Boundary FAIL — ${violations.length} violation(s).`);
    for (const violation of violations) console.error(`[${violation.code}] ${violation.file ?? "graph"}: ${violation.message}`);
  }
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
