# XIANGXU Gate 4.0 / Stage 2 Layering Evidence

> Stage: Gate 4.0 / Stage 2 — Workspace Layering & Import Boundary  
> Audited at: 2026-08-11T13:41:00+08:00  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 2 PASS**  
> Stage 3: not started  
> Gate 4.1: not started

## 1. Scope

Stage 2 establishes only eight workspace/package skeletons and machine-verifiable dependency boundaries. Every production `src/index.ts` is exactly an empty TypeScript module (`export {};`). No Domain object, use case, port, adapter, transport schema, UI component, application runtime, database/queue integration, or provider behavior was created.

```text
Stage 2 PASS — Stage 3 not started.
Gate 4.1 not started.
```

## 2. Runtime and Handoff Pre-check

| Evidence | Result |
|---|---|
| Node | `v24.19.0` |
| pnpm | `11.21.0` |
| selected Node | `C:\Users\Administrator\.cache\xiangxu-runtimes\node-v24.19.0-win-x64\node.exe` |
| selected pnpm | `C:\Users\Administrator\.cache\xiangxu-runtimes\node-v24.19.0-win-x64\pnpm.CMD` |
| project registry | `https://registry.npmjs.org/` |
| pre-work handoff integrity | `32 / 32 SHA-256 unchanged` |
| manifest SHA-256 | `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` |

The isolated runtime was explicitly placed first on PATH. No machine-global runtime or registry setting was changed.

## 3. Governance and SSOT Resolution

Read before implementation:

- root, `apps/`, `packages/`, and `docs/codex/` governance;
- handoff `CURRENT_GATE.md`;
- Gate 3.8 `08_Detailed_System_Design_API_V1.0.docx` sections 3, 10, 12, 13, 14, 25, and 27;
- the handoff architecture-boundary section.

Gate 3.8 provided the more precise dependency permissions and did not conflict with the Stage 2 instruction. Resolution:

| Source | Allowed workspace dependencies in Stage 2 matrix |
|---|---|
| domain | contracts primitives, type-only |
| application | domain; contracts |
| infrastructure | application ports; contracts |
| web | application; contracts; UI |
| worker | application; infrastructure; contracts |
| contracts | none during Stage 2 |
| UI | contracts-safe DTO types, type-only |
| testing | test-visible workspaces; remains test-only |

Only `application -> domain` is declared in the real Stage 2 manifests. Other permitted directions are capabilities frozen in the matrix, not speculative dependencies.

## 4. Workspace Graph and Package List

pnpm recognizes the root plus eight workspace projects:

```text
@xiangxu/web
@xiangxu/worker
@xiangxu/domain
@xiangxu/application
@xiangxu/infrastructure
@xiangxu/contracts
@xiangxu/ui
@xiangxu/testing
```

Each workspace contains only:

```text
AGENTS.md
package.json
tsconfig.json
src/index.ts
```

`packages/testing` additionally owns isolated architecture fixtures. All eight `tsconfig.json` files extend `../../tsconfig.base.json`, retain strict mode, and include only their own `src/**/*.ts`.

Real manifest graph:

```text
@xiangxu/application -> @xiangxu/domain
```

The graph is acyclic. All other workspace nodes are empty skeletons with no declared dependency.

## 5. Machine-readable Boundary Matrix

Source: `tools/boundary/boundary-matrix.json`  
Schema: `tools/boundary/boundary-matrix.schema.json`

The checker validates:

1. every configured workspace exists and has the expected package name;
2. every actual `apps/*` / `packages/*` manifest is registered in the matrix;
3. `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`;
4. internal dependencies use the `workspace:` protocol;
5. production workspaces cannot depend on `@xiangxu/testing`;
6. external dependencies/imports are not approved for Stage 2 workspaces;
7. static imports, exports, import types, dynamic imports, and CommonJS `require` in `src`;
8. type-only edges remain type-only;
9. cross-package relative imports are rejected;
10. cross-package deep imports are rejected;
11. imported workspace packages are declared in a manifest dependency section;
12. workspace manifest cycles are rejected.

The checker uses only Node.js and the Stage 1 approved TypeScript compiler API. No architecture plugin or new dependency was introduced.

## 6. Positive Fixture

Fixture: `packages/testing/fixtures/boundary/positive`

It declares and imports:

```text
@xiangxu/application -> @xiangxu/domain
```

Raw checker result:

```text
exit code: 0
Boundary PASS — 2 workspaces, 2 source files, 1 manifest edges.
```

## 7. Negative Fixture and Raw Expected-failure Evidence

Fixture: `packages/testing/fixtures/boundary/negative`

Raw command:

```powershell
node tools/boundary/check-boundaries.mjs `
  --root packages/testing/fixtures/boundary/negative `
  --allow-partial
```

Raw result:

```text
exit code: 1
Boundary FAIL — 12 violation(s).
[cross-package-relative-import] domain -> application
[deep-import] @xiangxu/application/src/private.js
[forbidden-workspace-dependency] application -> infrastructure
[forbidden-workspace-dependency] domain -> application
[forbidden-workspace-dependency] domain -> infrastructure
[production-depends-on-testing] domain -> testing
[undeclared-workspace-import] application -> infrastructure
[undeclared-workspace-import] domain -> infrastructure
[workspace-cycle] domain -> application -> domain
```

Repeated records occur where the same forbidden edge is deliberately present in both a manifest and multiple source import forms. The raw illegal fixture remains isolated from production lint/typecheck inputs.

Self-test result:

```text
exit code: 0
Boundary self-test PASS — positive exit 0; negative exit 1; 12 expected violation records.
```

The harness asserts all required violation classes and explicitly verifies the three forbidden edges `domain -> application`, `domain -> infrastructure`, and `application -> infrastructure`.

## 8. Dependency and Lockfile Delta

| Check | Stage 1 | Stage 2 | Result |
|---|---:|---:|---|
| root external direct packages | 5 dev tools | same 5 dev tools | unchanged |
| workspace external dependencies | 0 | 0 | PASS |
| production dependencies | 0 | 0 | PASS |
| lockfile importers | 1 | 9 | expected workspace-only delta |
| lockfile SHA-512 integrity records | 95 | 95 | external graph unchanged |
| exotic source records | 0 | 0 | PASS |
| `requiresBuild: true` | 0 | 0 | PASS |
| esbuild records | 0 | 0 | PASS |
| `allowBuilds` | `{}` | `{}` | not expanded |
| pending builds | `[]` | `[]` | no unknown lifecycle/build execution |

The first `pnpm boundary` invocation refreshed workspace importers/links because manifests had changed; it added no external package and executed no lifecycle script. The explicit final `pnpm install --frozen-lockfile` then passed with all nine workspace projects already up to date.

## 9. Validation Commands

| Command | Exit | Result |
|---|---:|---|
| runtime version/path checks | 0 | exact Node/pnpm selected |
| pre-work handoff SHA-256 | 0 | 32/32 |
| Gate 3.8 structured DOCX extraction | 0 | minimum boundary SSOT read; handoff unchanged |
| `pnpm list -r --depth -1` | 0 | root + eight workspaces |
| initial `pnpm boundary` | 0 | real graph PASS |
| raw negative checker | 1 (expected) | 12 violations identified |
| `pnpm boundary:test` | 0 | positive PASS + negative expected FAIL verified |
| first `pnpm lint` | 1 (corrective) | one unused checker variable detected |
| `pnpm lint` after one-line cleanup | 0 | PASS without rule weakening |
| `pnpm typecheck` | 0 | 8/8 strict workspace tasks passed |
| `pnpm install --frozen-lockfile` | 0 | all 9 projects already up to date |
| final `pnpm verify` | 0 | lint + 8/8 typecheck + boundary + self-test + task graphs |
| structural acceptance assertions | 0 | 8 skeletons; 0 external deps; no later-Stage dependency |
| final handoff SHA-256 | 0 | 32/32 |

`pnpm test` and `pnpm build` execute legal Turbo graphs with zero package tasks because Stage 2 owns neither runtime implementation nor tests/build outputs. The required Stage 2 verification is strict typecheck and boundary enforcement, both of which execute real tasks.

## 10. Acceptance Criteria

- [x] 1. Exact Node/pnpm runtime re-verified.
- [x] 2. Pre-work handoff hash is 32/32.
- [x] 3. `apps/web` skeleton created.
- [x] 4. `apps/worker` skeleton created.
- [x] 5. All six package skeletons created.
- [x] 6. pnpm recognizes all workspaces.
- [x] 7. Domain remains pure TypeScript.
- [x] 8. Domain has no framework/database/provider dependency.
- [x] 9. Application direction matches SSOT.
- [x] 10. Infrastructure direction matches SSOT.
- [x] 11. Apps are outermost in the matrix.
- [x] 12. Contracts/UI contain no Stage 4 implementation.
- [x] 13. Production-to-testing dependencies are rejected.
- [x] 14. Boundary matrix is machine-readable.
- [x] 15. Source import boundaries are automated.
- [x] 16. Workspace manifest boundaries are automated.
- [x] 17. Cross-package relative import is rejected.
- [x] 18. Illegal deep import is rejected.
- [x] 19. Positive fixture passes.
- [x] 20. Negative fixture is correctly rejected.
- [x] 21. Raw negative checker returns non-zero.
- [x] 22. Boundary self-test passes.
- [x] 23. `pnpm lint` passes.
- [x] 24. `pnpm typecheck` passes for 8/8 workspaces.
- [x] 25. `pnpm boundary` passes.
- [x] 26. `pnpm boundary:test` passes.
- [x] 27. `pnpm verify` includes boundary checks and passes.
- [x] 28. No unapproved production dependency exists.
- [x] 29. No unknown lifecycle/build script executed.
- [x] 30. Frozen-lockfile installation passes.
- [x] 31. Final handoff hash is 32/32.
- [x] 32. No Stage 3 Web/Worker Shell was created.
- [x] 33. No Stage 4 Contracts/UI implementation was created.
- [x] 34. No Stage 5 database/queue implementation was created.
- [x] 35. Gate 4.1 was not started.

## 11. Known Risks and Deferred Work

- The matrix intentionally describes Stage 2 permissions. Framework/runtime dependencies remain denied until their owning Stage updates the matrix with reviewed evidence.
- Static source scanning is confined to each workspace `src` tree, which is also the strict TypeScript input. Generated or non-source artifacts must not become production inputs without updating enforcement.
- Contracts type primitives and UI DTO consumption are permitted by Gate 3.8 but deliberately unused until Stage 4.
- Web and Worker packages are names and empty TypeScript modules only. Next.js routes, React, HTTP/Worker processes, health endpoints, and fake jobs remain Stage 3 work.
- Database, Drizzle, Redis, BullMQ, migrations, and providers remain Stage 5 or later.

## 12. Final Status

```text
Stage 2 PASS — Stage 3 not started.
Gate 4.1 not started.
```
