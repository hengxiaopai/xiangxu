# XIANGXU Gate 4.0 / Stage 6 Unified Verification & CI Evidence

> Stage: Gate 4.0 / Stage 6 — Unified Verification & CI  
> Audited at: 2026-08-12  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 6 PASS**  
> Stage 7: not started  
> Gate 4.1: not started

## 1. Result and Scope

Stage 6 is complete. The public repository has one minimal GitHub Actions Gate
workflow, a fail-closed static policy checker, an isolated negative fixture,
and a single local/CI verification entry point. Exact corrective commit
`964a965dfd6b6161c3a55f30fc557b255a68fea1` passed a fresh GitHub-hosted
`ubuntu-24.04` run from checkout through frozen install, complete
`pnpm verify`, and cleanup.

No browser or visual evidence, accessibility pass, product feature, business
database model, production queue workflow, authentication, AI, provider, or
connector work was started.

```text
Stage 6 PASS — Stage 7 not started.
Gate 4.1 not started.
```

## 2. Source of Truth and Governance

The minimum Stage 6 source of truth was read before implementation:

```text
CURRENT_GATE.md
AGENTS.md
docs/codex/AGENTS.md
README.md
Stage 0–5 evidence records
Gate 3.8 sections directly covering testing, CI, verification, build,
security/privacy, contracts, and versioned database migration
```

Stage 5 was already formally recorded as PASS. The Gate 3.8 material was used
only to preserve existing verification/security requirements; no business or
architecture contract was reinterpreted.

## 3. Runtime and Handoff Integrity

| Check | Local observed result |
|---|---|
| Node | `v24.19.0` |
| pnpm | `11.21.0` |
| selected Node | `E:\sofeware\node-v24.19.0-win-x64\node.exe` |
| selected pnpm | `E:\sofeware\node-v24.19.0-win-x64\pnpm.CMD` |
| registry | `https://registry.npmjs.org/` |
| handoff before material work | `32 / 32 SHA-256 unchanged` |
| handoff after material work | recorded in Section 13 after final audit |

All accepted local commands placed the approved Node directory first in the
process-local `PATH`. No machine-wide runtime or registry setting was changed.

## 4. Git Publication State

The initial publication-checkpoint inspection found:

```text
branch: main
HEAD: absent / unborn repository
remotes: 0
tracked files: 0
repository files: untracked
```

At that checkpoint there was no repository URL, published commit SHA, workflow
run ID, or hosted-runner conclusion to cite, so Stage 6 correctly remained
BLOCKED. No publication action was taken without authorization.

Human publication authorization was received on 2026-08-12 for the public,
human-created empty repository `hengxiaopai/xiangxu`. The authorized target is
`origin/main`; one initial commit and a normal push are allowed. Force push,
tags, releases, Stage 7, and Gate 4.1 remain forbidden.

The repeated publication preflight observed:

```text
branch: main
HEAD: absent / unborn repository
remote before configuration: none
approved remote after configuration:
https://github.com/hengxiaopai/xiangxu.git
remote repository: public and empty; remote refs 0
prospective committed files: 129
forbidden generated/runtime candidate paths: 0
high-confidence API/token/private-key secret files: 0
generic literal credential hits in runtime source/config: 0
private key/certificate candidates: 0
archive/database dump candidates: 0
unexpected runtime absolute machine-path dependencies: 0
```

Public-repository safety required two minimal ignore-policy additions:

```text
XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/
*.tsbuildinfo
```

The first keeps the local read-only upstream SSOT out of the public repository
without moving or modifying it. The second excludes a discovered TypeScript
incremental build cache. Existing `node_modules`, `.next`, `dist`, `.turbo`,
environment, log, IDE, and OS artifact rules remain active. `.env.example` is
an intentional repository template containing local-only placeholders, not a
runtime secret file.

Docker Desktop's daemon was stopped during this repeated preflight, so its API
could not enumerate volumes. No local Stage Worker/Infrastructure process was
running, and the immediately preceding completed Stage 6 cleanup audit had
recorded zero XIANGXU containers and volumes. Docker availability and clean
resource ownership remain fail-closed assertions in the real hosted workflow.

## 5. CI Workflow

The single workflow is `.github/workflows/ci.yml`, with one `verify` job and
only the approved triggers:

```text
push to main
pull_request
workflow_dispatch
```

Security and supply-chain configuration:

| Invariant | Workflow value |
|---|---|
| runner | `ubuntu-24.04` |
| permissions | `contents: read` |
| timeout | 30 minutes |
| concurrency | branch/ref group; `cancel-in-progress: true` |
| checkout | `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` |
| pnpm/Node setup | `pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2` |
| setup install | `false` |
| setup cache | `false` |
| checkout credentials | not persisted |
| other Actions | none |
| secrets | none |
| workflow service containers | none |

The 30-minute timeout is a conservative ceiling for a cold network install,
Docker image acquisition, builds, HTTP/Worker smoke, and PostgreSQL/Redis/
BullMQ verification. The final warm local verification took 35.3 seconds;
the timeout limits hangs without assuming hosted-network performance.

The workflow asserts exact Node and pnpm versions, the official registry, an
absent `node_modules`, the lockfile hash before and after install, lifecycle
governance, Docker/Compose availability, and post-verification cleanup. Its
only install and verification commands are exactly:

```text
pnpm install --frozen-lockfile
pnpm verify
```

It does not duplicate boundary, contract, build, route, Worker, database, or
queue checks. These remain owned by repository commands invoked through
`pnpm verify`.

## 6. Workflow Policy Checker and Negative Proof

`tools/ci/check-workflow.mjs` uses Node built-ins only. It is deliberately a
bounded lexical validator of the Stage 6 invariants, not a general YAML parser
or a complete workflow-security analyzer.

`pnpm ci:check` first validates the real workflow, then invokes the raw checker
against `tools/ci/fixtures/invalid-ci.yml`. The fixture contains a floating
Action tag, `pull_request_target`, write permission, `continue-on-error: true`,
and `npm install`.

Observed local evidence:

```text
real workflow raw checker: exit 0
negative fixture raw checker: exit 1
negative fixture: 33 violation records
self-test: PASS
```

The required violations were explicitly observed: `unpinned-action`,
`forbidden-trigger`, `write-permission`, `continue-on-error`, and
`npm-install`.

## 7. Frozen Install and Lifecycle Governance

The accepted local frozen install exited `0` across all nine workspaces. The
lockfile hash was identical before and after:

```text
46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79
```

`pnpm ignored-builds` reported no automatically pending builds and continued
to report exact `msgpackr-extract@3.0.4` as explicitly denied. The existing
three exact approved esbuild lifecycle entries were not changed. No dependency,
YAML parser, Actions emulator, lifecycle approval, lockfile resolution, or
production package was added.

## 8. Local Unified Verification

The final local `pnpm verify` exited `0` in 35.3 seconds and covered:

```text
CI policy and negative self-test PASS
lint PASS
strict typecheck 8/8 PASS
boundary PASS: 8 workspaces, 34 source files, 2 manifest edges
boundary negative self-test PASS: 56 expected violations
contracts check PASS; deterministic OpenAPI artifact byte-stable
tokens check PASS: 11 files
test graph 8/8 PASS
Web production build PASS
/login HTTP smoke 200
/app/today HTTP smoke 200
Worker health/fake-job/graceful-shutdown smoke PASS
workspace build graph 4/4 PASS
PostgreSQL 18.4 migration and sentinel smoke PASS
Redis 8.2.8 PONG/version smoke PASS
BullMQ fake job 7 -> 14, completed PASS
```

After the first hosted-runner portability correction, a second complete local
`pnpm verify` exited `0` in 109.7 seconds. The cold Web build and Docker smoke
were rerun; Web typecheck explicitly generated fresh Next route types before
strict TypeScript, and the same full result set above remained PASS.

The Infrastructure checks used the Stage 5 Compose definition and pinned
PostgreSQL/Redis images. No skip environment variable or parallel CI-only
verification path was introduced.

## 9. Local Cleanup and Network Boundary

The final local cleanup audit found:

```text
XIANGXU containers: 0
XIANGXU volumes: 0
Stage Worker/Infrastructure Node processes: 0
```

The workflow has matching fail-closed residue assertions. Those assertions
cannot be reported as hosted-CI PASS until a real run exists.

Verification requires only package/Docker artifact acquisition plus ephemeral
loopback PostgreSQL and Redis. It requires no repository secret and performs
no OpenAI, Anthropic, WeChat, email, SMS, calendar, OAuth, or external business
API call. Logs do not print ephemeral infrastructure credentials or tokens.

## 10. Corrective Changes During Local Verification

Three checker/portability defects were found and corrected without weakening
verification:

| Failure | Root cause | Minimal change | Retest |
|---|---|---|---|
| Valid runner produced a checker false positive | the initial negative-lookahead runner pattern was ambiguous | enumerate every `runs-on` value and require exactly one `ubuntu-24.04` | `pnpm ci:check` PASS |
| Negative YAML list entries were not detected | patterns did not accept the optional YAML list marker | accept optional `-` before `uses` and `continue-on-error` | raw negative exit `1`; self-test PASS |
| Linux cleanup could match its own `awk` command | process matching inspected the whole command row for `node` | inspect `comm` and require the process executable field to equal `node` | `pnpm ci:check` and complete `pnpm verify` PASS |
| Hosted run `31552743256` failed Web typecheck on the initial commit | a clean checkout had no `.next`, while committed `next-env.d.ts` correctly referenced generated `.next/types/routes.d.ts` and `root-params.d.ts`; the prior local build cache masked this ordering defect | change only `@xiangxu/web` typecheck to `next typegen && tsc --project tsconfig.json --noEmit` | local `.next` was moved out of the repository; fresh route/root-parameter types generated; targeted typecheck PASS; complete local `pnpm verify` exit `0` |

The initial real-CI failure remains part of the audit history. Corrective run
`31553121149` passed on the exact minimal-fix commit and closed the defect
without weakening verification.

## 11. CI/Local Parity and Known Risks

The canonical install and verification commands are shared. Environment
preparation remains workflow-owned; all substantive engineering verification
remains repository-owned. The Windows Worker IPC/SIGTERM smoke path from Stage
3 was preserved, while Linux is expected to use its platform-appropriate
graceful shutdown path.

The hosted runner proved the Linux path, cold package and image acquisition,
Docker 28.0.4, Docker Compose v2.38.2, complete verification, and cleanup. No
Stage 6 acceptance item remains open. Browser/visual/accessibility evidence is
still deliberately deferred to Stage 7 and was not started.

## 12. Acceptance Criteria (57/57)

| Criteria | Evidence state | Result |
|---|---|---|
| 1–5 Governance | exact local runtime; pre-hash; Stage 5 PASS; no Stage 7 | PASS |
| 6–15 Workflow security | static workflow and checker evidence | PASS |
| 16–24 CI runtime/install | hosted Node/pnpm/registry/fresh workspace/cache-off/frozen install/lock/lifecycle evidence | PASS |
| 25–29 verification entry/policy | local raw/self-tests and unified verify pass; workflow calls exact command | PASS |
| 30–43 CI verification results | hosted lint, strict types, boundaries, contracts, tokens, Web/Worker, PostgreSQL/Redis/BullMQ, complete `pnpm verify` | PASS |
| 44–45 no secrets/provider calls | workflow/source audit | PASS |
| 46–48 cleanup | hosted cleanup step success; local containers/volumes/processes zero | PASS |
| 49 lockfile integrity | same SHA-256 before/after local and hosted frozen install | PASS |
| 50 handoff post-hash | final audit in Section 13 | PASS |
| 51–55 real CI traceability | repository, exact commit, run/job IDs, runner label and success conclusion recorded | PASS |
| 56–57 non-entry | Stage 7 and Gate 4.1 not started | PASS |

## 13. Final Integrity and Publication Fields

Final local audit:

```text
pnpm-lock.yaml SHA-256:
46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79

.github/workflows/ci.yml SHA-256:
dc7a7b080ffa79a366de4486cb91277860d649daa7ece761fb1c6e77f258a9ac

handoff post-hash:
32 / 32 SHA-256 unchanged
```

The initial publication and first hosted run produced:

```text
GitHub repository: hengxiaopai/xiangxu
remote: https://github.com/hengxiaopai/xiangxu.git
workflow name: CI
initial commit SHA: 9b502b7036a954c97fc13b5de0305c36046dc064
initial push: success; origin/main created without force
initial run ID: 31552743256
initial run URL: https://github.com/hengxiaopai/xiangxu/actions/runs/31552743256
runner label: ubuntu-24.04
initial conclusion: failure
initial pnpm verify exit status: 2
failure step: Unified verification / @xiangxu/web#typecheck
corrective commit SHA: 964a965dfd6b6161c3a55f30fc557b255a68fea1
corrective push: normal fast-forward; no force
corrective run ID: 31553121149
corrective run URL: https://github.com/hengxiaopai/xiangxu/actions/runs/31553121149
corrective job ID: 93979878186
runner group: GitHub Actions
runner label: ubuntu-24.04
hosted Node: v24.19.0
hosted pnpm: 11.21.0
hosted registry: https://registry.npmjs.org/
hosted Docker: 28.0.4
hosted Docker Compose: v2.38.2
lockfile before/after: 46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79
corrective pnpm verify exit status: 0
hosted cleanup: success
corrective conclusion: success
```

The corrective run's head SHA exactly matches the published corrective commit.
Every required workflow step concluded `success`, including unified
verification, cleanup, and the built-in job summary.

## 14. Final Status

```text
Stage 6 PASS — Stage 7 not started.
Gate 4.1 not started.
```
