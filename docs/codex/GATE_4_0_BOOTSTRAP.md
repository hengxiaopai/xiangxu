# XIANGXU Gate 4.0 / Stage 1 Bootstrap Evidence

> Stage: Gate 4.0 / Stage 1 — Repository Governance  
> Audited at: 2026-08-11T11:19:35+08:00  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 1 PASS**  
> Gate 4.1: not started

## 1. Scope and Result

Stage 1 establishes only a reproducible, constrained, and auditable repository-governance and toolchain foundation. No Web Shell, Worker Shell, package implementation, Contracts, UI tokens, database, Redis/BullMQ, business behavior, Stage 2 implementation, or Gate 4.1 work was created.

```text
Stage 1 PASS — Stage 2 not started.
Gate 4.1 not started.
```

## 2. Environment

| Evidence | Result |
|---|---|
| Node actual | `v24.19.0` |
| Node executable selected first | `C:\Users\Administrator\.cache\xiangxu-runtimes\node-v24.19.0-win-x64\node.exe` |
| pnpm actual | `11.21.0` |
| pnpm executable selected first | `C:\Users\Administrator\.cache\xiangxu-runtimes\node-v24.19.0-win-x64\pnpm.CMD` |
| Corepack bundled with selected Node | `0.35.0` |
| Project npm registry | `https://registry.npmjs.org/` |
| Project pnpm registry | `https://registry.npmjs.org/` |
| User-effective npm registry outside repository | `https://registry.npmmirror.com` |
| User-effective pnpm registry outside repository | `https://registry.npmmirror.com` |

The official Node archive `node-v24.19.0-win-x64.zip` was verified before extraction against the official `SHASUMS256.txt`: expected and actual SHA-256 were both `57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73`. The isolated runtime was prepended explicitly for every dependency/tooling command; the machine-wide PATH and user-global registry configuration were not changed.

`where node` and `where pnpm` showed the exact isolated runtime shims first. Older machine installations remained later on PATH and were not used to resolve or install this repository.

## 3. Repository

| Evidence | Result |
|---|---|
| Git root | `G:/codex/xiangxu` |
| Branch | `main` |
| History | initialized; no commits created by Stage 1 |
| Workspace root | recognized as private package `xiangxu@0.0.0` |
| Workspace packages | 0 implementation packages, as required for Stage 1 |

Governed root files created in Stage 1:

```text
.env.example
.gitignore
.npmrc
AGENTS.md
README.md
eslint.config.mjs
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
turbo.json
```

Evidence and permitted nested governance:

```text
apps/AGENTS.md
packages/AGENTS.md
docs/codex/AGENTS.md
docs/codex/GATE_4_0_BOOTSTRAP.md
```

`.git/`, `node_modules/`, and `.turbo/` are generated operational directories; dependency/cache directories are ignored by `.gitignore`. Git status contains only untracked, not-yet-committed repository bootstrap and pre-existing handoff/evidence content. No pre-existing Evidence was overwritten.

## 4. Dependency Governance

### 4.1 Exact direct tooling

Only Stage 0 approved development tooling is present, with exact versions:

| Package | Version | Installed tool evidence |
|---|---:|---:|
| `turbo` | `2.10.9` | `2.10.9` |
| `typescript` | `6.0.3` | `Version 6.0.3` |
| `eslint` | `10.8.1` | `v10.8.1` |
| `@eslint/js` | `10.0.1` | dependency tree exact |
| `typescript-eslint` | `8.67.0` | dependency tree exact |

There are no production dependencies. `packageManager` is exactly `pnpm@11.21.0`; `engines.node` is exactly `24.19.0`; `engines.pnpm` is exactly `11.21.0`. No range operator, `latest`, `next`, or wildcard is used for direct tooling.

### 4.2 Resolution policy and release-age exception

Project policy retains:

```text
registry = https://registry.npmjs.org/
minimumReleaseAge = 1440
blockExoticSubdeps = true
strictDepBuilds = true
engineStrict = true
allowBuilds = {}
```

The first dry-run correctly stopped because the Stage 0 locked `typescript-eslint@8.67.0` family had been published less than 24 hours earlier. A combined scope/version pattern was also rejected by pnpm's configuration validator and made no changes. The final configuration lists only the eleven exact `@typescript-eslint`/`typescript-eslint` packages at `8.67.0` under `minimumReleaseAgeExclude`; the repository-wide 24-hour policy remains enabled for every other package.

### 4.3 Lockfile and provenance

The first lockfile was created with:

```powershell
pnpm install --lockfile-only --ignore-scripts
```

Results:

- lockfile version: `9.0`;
- 95 registry package records and 95 SHA-512 integrity fields;
- 0 exotic/git/HTTP source overrides;
- 0 `requiresBuild: true` entries;
- 0 `esbuild` entries (the Stage 0 esbuild candidate belongs to later tooling, not this Stage 1 tree);
- all five direct dev dependencies resolve to their exact Stage 0 versions.

### 4.4 Lifecycle/build-script audit

All 95 lockfile package/version records were queried from the official npm registry with 0 metadata errors.

| Lifecycle class | Packages |
|---|---:|
| `preinstall` | 0 |
| `install` | 0 |
| `postinstall` | 0 |
| native / lockfile `requiresBuild` | 0 |
| published source `prepare` metadata | 12 |

The 12 source `prepare` records were: `@humanfs/core@0.19.2`, `@humanfs/node@0.16.8`, `@humanfs/types@0.15.0`, `@humanwhocodes/module-importer@1.0.1`, `@humanwhocodes/retry@0.4.3`, `acorn@8.18.0`, `balanced-match@4.0.4`, `brace-expansion@5.0.9`, `eslint-visitor-keys@3.4.3`, `keyv@4.5.4`, `minimatch@10.2.6`, and `ts-api-utils@2.5.0`. These are registry-tarball source preparation fields, not consumer install hooks, and normal registry installation did not execute them.

Because the resolved tree contains no consumer install/build hook, the precise pnpm 11 allowlist is the empty map `allowBuilds: {}`. This is deny-by-default, not a broad approval. `dangerouslyAllowAllBuilds` is absent.

The normal frozen install ran without `--ignore-scripts` and printed no lifecycle execution. The generated `node_modules/.modules.yaml` records `pendingBuilds: []` and `allowBuilds: {}`. `pnpm ignored-builds` returned exit 0 and listed no package. Its text `Cannot identify as no node_modules found` is a pnpm 11.21.0 wording defect: the local implementation emits that text whenever the `ignoredBuilds` field is absent; the module directory exists and its manifest proves there are no pending builds.

### 4.5 License inventory

`pnpm licenses list --json` completed successfully over the installed frozen tree. Inventory summary:

| SPDX license | Unique package records |
|---|---:|
| MIT | 63 |
| Apache-2.0 | 12 |
| BSD-2-Clause | 6 |
| BSD-3-Clause | 1 |
| ISC | 5 |
| BlueOak-1.0.0 | 1 |

No missing/unknown license group was reported. Non-MIT/Apache packages are confined to the audited toolchain's transitive graph; no production dependency exists.

## 5. Governance Foundation

| Area | Evidence |
|---|---|
| Workspace | `apps/*` and `packages/*` declared; configuration parsed by pnpm 11.21.0 |
| TypeScript | shared `tsconfig.base.json` has `strict: true`, additional strictness, `noEmit: true`, and no business source/include |
| ESLint | one flat config, one root command `eslint .`, no `next lint`, no Biome/second linter |
| Turbo | legal task skeleton for `lint`, `typecheck`, `test`, and `build`; root commands invoke it successfully |
| Root governance | Gate boundary, handoff immutability, dependency rules, architecture direction, ownership, and commands recorded |
| Nested governance | only the permitted `apps/`, `packages/`, and `docs/codex/` instructions were added |

Turbo reported 0 packages/tasks for typecheck/test/build, which is the expected Stage 1 outcome: the root graph is valid and no Stage 2 package was fabricated merely to create work.

## 6. Handoff Integrity

Manifest: `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/SHA256SUMS.txt`  
Manifest file SHA-256: `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc`

| Checkpoint | Result |
|---|---|
| Before `git init` | `32 / 32 SHA-256 unchanged` |
| Immediately after `git init` | `32 / 32 SHA-256 unchanged` |
| Final Stage 1 verification | recorded after final Evidence write; `32 / 32 SHA-256 unchanged` |

The handoff directory remained in place and was not moved, renamed, formatted, rewritten, auto-fixed, or used as a tooling target.

## 7. Command Ledger

| Command / check | Exit | Result |
|---|---:|---|
| official Node archive SHA-256 check | 0 | exact match |
| `node --version`; `pnpm --version`; `where node`; `where pnpm` | 0 | exact isolated executables selected first |
| project/user `npm config get registry`; `pnpm config get registry` | 0 | project official; user mirror unchanged |
| handoff SHA-256 before Git | 0 | 32/32 |
| `git init -b main` | 0 | repository initialized |
| handoff SHA-256 immediately after Git | 0 | 32/32 |
| `pnpm install --dry-run` before maturity exception | 1 (expected) | security policy blocked same-day locked release |
| dry-run with invalid scope/version pattern | 1 (expected) | pnpm rejected invalid exception syntax; no files changed |
| corrected exact-package `pnpm install --dry-run` | 0 | 95-package graph resolved; nothing installed/written |
| `pnpm install --lockfile-only --ignore-scripts` | 0 | initial auditable lockfile generated; no script execution |
| official-registry lifecycle metadata audit | 0 | 95/95 queried; 0 errors; 0 consumer install hooks |
| lock source/integrity/build-marker audit | 0 | 95 integrities; no exotic source, esbuild, or requiresBuild |
| `pnpm install --frozen-lockfile` | 0 | normal frozen install; 90 current-platform packages added; no scripts executed |
| `pnpm install --frozen-lockfile --offline` | 0 | already up to date; reproducible from content-addressable store |
| `pnpm ignored-builds` + modules-manifest verification | 0 | no ignored/pending package build |
| `pnpm licenses list --json` | 0 | complete installed-tree inventory; no unknown license group |
| `pnpm lint` | 0 | ESLint CLI passed |
| `pnpm typecheck` | 0 | valid Turbo skeleton; expected 0 Stage 2 packages |
| `pnpm test` | 0 | valid Turbo skeleton; expected 0 Stage 2 packages |
| `pnpm build` | 0 | valid Turbo skeleton; expected 0 Stage 2 packages |
| `pnpm verify` | 0 | lint + typecheck + test + build all passed |
| final handoff SHA-256 | 0 | 32/32 |

## 8. Acceptance Criteria

- [x] 1. Node = `24.19.0`.
- [x] 2. pnpm = `11.21.0`.
- [x] 3. Actual executable paths recorded.
- [x] 4. Repository uses official npm registry.
- [x] 5. User-global registry not destructively modified.
- [x] 6. Git repository initialized successfully.
- [x] 7. pnpm workspace root recognized.
- [x] 8. `packageManager` exactly locked.
- [x] 9. Node engine matches the runtime lock.
- [x] 10. Turborepo configuration legal.
- [x] 11. TypeScript strict base established.
- [x] 12. ESLint Flat Config established.
- [x] 13. Only lint entry is ESLint CLI.
- [x] 14. `next lint` absent.
- [x] 15. Lockfile generated under the exact Node/pnpm pair.
- [x] 16. Install scripts reviewed across the resolved graph.
- [x] 17. No unknown build script executed.
- [x] 18. `allowBuilds` is the exact empty allowlist required by this graph.
- [x] 19. Frozen-lockfile installation succeeded.
- [x] 20. Root and permitted nested governance established.
- [x] 21. No Stage 2 business/layer implementation created.
- [x] 22. Handoff package remains 32/32 hash-identical.
- [x] 23. Gate 4.1 not started.

## 9. Known Operational Note

The exact Node/pnpm pair is intentionally isolated rather than installed globally. A new shell must explicitly select `C:\Users\Administrator\.cache\xiangxu-runtimes\node-v24.19.0-win-x64` first on PATH before repository commands. This preserves the user's existing machine runtime and registry configuration while keeping repository operations reproducible.

## 10. Final Status

```text
Stage 1 PASS — Stage 2 not started.
Gate 4.1 not started.
```
