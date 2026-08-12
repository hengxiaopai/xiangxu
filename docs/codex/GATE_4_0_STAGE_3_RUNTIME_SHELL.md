# XIANGXU Gate 4.0 / Stage 3 Runtime Shell Evidence

> Stage: Gate 4.0 / Stage 3 — Web & Worker Runtime Shell  
> Audited at: 2026-08-11T16:06:08+08:00  
> Recovery audited at: 2026-08-11T16:30:02+08:00  
> Recovery completed at: 2026-08-11T20:32:53+08:00  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 3 PASS**  
> Stage 4: not started  
> Gate 4.1: not started

## 1. Result

Stage 3 PASS. The original dependency-acquisition blocker and the first unsuccessful Recovery attempt are retained in Section 9. A subsequent human-assisted network recovery downloaded the exact official artifact through pnpm, preserved the lockfile, and completed both offline and normal frozen installs.

Post-install verification proved Next.js 16.3.0 with TypeScript 6.0.3, the production Web server and both required routes, the Worker health/fake-job/graceful-shutdown path, strict lint/typecheck, boundary enforcement and self-test, and the complete `pnpm verify` task graph.

Stage 4 and Gate 4.1 were not started.

```text
Stage 3 PASS — Stage 4 not started.
Gate 4.1 not started.
```

## 2. Completed Scope

Implemented and runtime-verified:

- Next.js App Router shell under `apps/web/src/app/`;
- `/login` semantic placeholder with no form or authentication;
- `/app/today` semantic shell with no business data or workflow;
- minimal temporary shell CSS using system colors, not a Stage 4 token/design system;
- Node built-in Worker HTTP `/health` capability;
- deterministic in-memory fake job with no network/filesystem/database/queue/provider side effect;
- Worker smoke orchestration for real child-process startup, health, fake job, SIGTERM, and clean exit;
- Web production-server HTTP smoke on a temporary local port;
- boundary-matrix and checker coverage for Web/Worker runtime imports and non-`src` Next inputs.

No authentication, Session, User, Task, Calendar, Inbox, Proposal, AI, provider, transport contract, OpenAPI, SSE, UI package implementation, database, Drizzle, PostgreSQL, Redis, or BullMQ code was created.

## 3. Runtime and Handoff

| Evidence | Result |
|---|---|
| Node | `v24.19.0` |
| pnpm | `11.21.0` |
| selected Node | `E:\sofeware\node-v24.19.0-win-x64\node.exe` |
| selected pnpm | `E:\sofeware\node-v24.19.0-win-x64\pnpm.CMD` |
| pre-work handoff | `32 / 32 SHA-256 unchanged` |
| post-work handoff | `32 / 32 SHA-256 unchanged` |
| manifest SHA-256 | `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` |

## 4. Dependency Approval

Stage 0 explicitly approved the exact packages needed here:

| Package | Version | Classification |
|---|---:|---|
| `next` | `16.3.0` | Web runtime |
| `react` | `19.2.8` | Web runtime |
| `react-dom` | `19.2.8` | Web runtime |
| `@types/node` | `24.13.3` | development types |
| `@types/react` | `19.2.18` | development types |
| `@types/react-dom` | `19.2.4` | development types |

Stage 0 compatibility evidence covers Node 24.19 + Next 16.3 and Next 16.3 + React 19.2.8. Registry metadata re-check found the same exact versions and compatible engine/peer ranges. No range, `latest`, `next`, caret, tilde, or wildcard manifest version was used.

Worker has zero runtime dependency and uses Node built-ins only.

## 5. Dependency and Lifecycle Delta

Initial optional route:

- `eslint-config-next@16.3.0` was Stage 0 version-approved, but a script-disabled 389-record lock graph revealed `unrs-resolver@1.12.2` with `postinstall: node postinstall.js`.
- This lifecycle path was not explicitly approved by Stage 0.
- Before any real install, `eslint-config-next` and its config were removed because the existing root ESLint + typescript-eslint path already lints TSX and preserves the single lint entry.
- The unapproved package and `napi-postinstall` disappeared completely from the final lockfile.

Final lock graph:

| Check | Stage 2 | Final Stage 3 lock | Delta/result |
|---|---:|---:|---|
| SHA-512 integrity records | 95 | 187 | +92 exact transitive records |
| exotic sources | 0 | 0 | unchanged |
| `requiresBuild: true` | 0 | 0 | unchanged |
| consumer lifecycle packages | 0 | 0 | 187/187 registry records audited |
| source `prepare` metadata | 12 | 12 | registry-tarball prepare only |
| `allowBuilds` | `{}` | `{}` | not expanded |
| esbuild | absent | absent | unchanged |

Targeted review:

- `sharp@0.35.3`: Node `>=20.9.0`; has a manual `build` command but no `preinstall/install/postinstall/prepare`; exact optional platform packages match Stage 0 review.
- `napi-postinstall`: absent from final graph.
- `@next/swc-win32-x64-msvc@16.3.0`: exact `win32/x64` precompiled package; no lifecycle script.
- `pnpm peers check`: exit 0, no peer dependency issue.

Lock-license metadata was present for all 187 records: MIT 123, Apache-2.0 29, ISC 10, LGPL-3.0-or-later 10, BSD-2-Clause 6, Apache/LGPL combined 3, BSD-3-Clause 2, and one each for 0BSD, BlueOak-1.0.0, CC-BY-4.0, and Apache/LGPL/MIT combined. LGPL entries are the reviewed optional sharp/libvips platform path; no package was installed or executed from this blocked attempt.

## 6. Boundary Delta and Coverage

Only owning workspaces were expanded:

- Web: exact `next`, `next/*`, `react`, `react/*`, `react-dom`, `react-dom/*`, and approved type packages.
- Worker: `node:*` and approved `@types/node` only.
- Domain, Application, Infrastructure, Contracts, UI, and Testing external allowances remain unchanged.

`apps/web/next.config.mjs` and `apps/web/next-env.d.ts` are explicit additional production/type inputs in the machine-readable matrix. The checker now scans 16 production source inputs and passes the real repository. Stage 2 positive/negative self-test remains PASS with negative exit 1 and 12 expected violations.

## 7. Web Structure

```text
apps/web/
  AGENTS.md
  next.config.mjs
  next-env.d.ts
  package.json
  tsconfig.json
  src/app/
    layout.tsx
    page.tsx                 # minimal redirect to /login
    shell.css                # temporary shell styling only
    login/page.tsx
    app/today/page.tsx
```

Both pages are Server Components. `/login` explicitly states that authentication is not implemented and contains no form. `/app/today` contains only header/nav/main/heading/placeholder text and no fake business data.

## 8. Worker Structure

```text
apps/worker/
  AGENTS.md
  package.json
  tsconfig.json
  tsconfig.build.json
  src/
    index.ts
    server.ts
    fake-job.ts
    smoke.ts
```

The source uses only `node:http`, `node:process`, `node:assert/strict`, `node:child_process`, `node:net`, `node:path`, and `node:url`. Runtime verification proved real child-process startup, health 200, deterministic fake-job completion, the registered SIGTERM shutdown handler, server close, and exit 0. Because Windows does not deliver a catchable POSIX SIGTERM through `child.kill`, the smoke-only IPC path asks the running child to emit its registered SIGTERM event; the production `process.once("SIGTERM")` path remains unchanged.

## 9. Install Blocker Evidence

| Command | Exit/result |
|---|---|
| `pnpm install --dry-run` | 0 after 89.6s; nothing written |
| `pnpm install --lockfile-only --ignore-scripts` | 0; auditable lock generated |
| first `pnpm install --frozen-lockfile` | timeout 124 after 94.1s with no output; residual PID 22940 terminated; no Web links |
| filtered `pnpm install --filter @xiangxu/web --frozen-lockfile --network-concurrency=4` | timeout 124 after 94.1s with no output; residual PID 23376 terminated; no Web links |
| `pnpm install --offline --frozen-lockfile` | 1; `ERR_PNPM_NO_OFFLINE_TARBALL`, missing `https://registry.npmjs.org/next/-/next-16.3.0.tgz` |
| final process audit | 0 remaining install processes |

The two online stalls exhausted the allowed retry route. No further network install was attempted. The shared pnpm store was not deleted or modified destructively.

### Recovery attempt — 2026-08-11

Runtime and integrity were re-established before network work:

| Check | Result |
|---|---|
| selected Node | `v24.19.0`; isolated runtime first in `where node` |
| selected pnpm | `11.21.0`; isolated runtime first in `where pnpm` |
| pre-Recovery handoff | `32 / 32 SHA-256 unchanged` |
| lockfile SHA-256 | `af3d4651fc3356e68308e113031be08385de60a56cbc9e66bad6d8619ac3d6d7` |

Official registry path diagnosis:

| Check | Result |
|---|---|
| DNS | PASS; official host resolved to Cloudflare-backed IPv4 and IPv6 addresses |
| TCP 443 | PASS; `registry.npmjs.org:443`, remote `104.16.2.34` |
| proxy environment | `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and `NO_PROXY` all unset; no credential value recorded |
| pnpm effective registry | `https://registry.npmjs.org/` |
| npm effective registry | `https://registry.npmjs.org/` |
| project `.npmrc` | `registry=https://registry.npmjs.org/` |

The transfer probe used `curl.exe` with the full response body directed to Windows `NUL`; it did not modify the repository, lockfile, or pnpm store:

| Probe evidence | Result |
|---|---|
| target | `https://registry.npmjs.org/next/-/next-16.3.0.tgz` |
| HTTP | `200`, `application/octet-stream` |
| remote endpoint | `104.16.3.34` |
| TLS verification | `ssl_verify_result=0` |
| expected response length | `41,543,045` bytes |
| transferred before hard stop | `7,533,888` bytes, about 18.1% |
| average transfer speed | `83,706` bytes/second |
| elapsed/result | `90.004081s`; curl exit `28` timeout |

This proves that name resolution and the TLS/HTTP handshake work, but the exact artifact still cannot be acquired reliably within the bounded operation. The Recovery instruction requires Stage 3 to remain BLOCKED and stop at this point.

Therefore the following Recovery steps were intentionally **not executed**:

- `pnpm fetch`;
- lockfile before/after fetch comparison (no fetch occurred, and the lockfile remained untouched);
- offline frozen install;
- normal frozen install;
- lifecycle/store linking verification;
- Next 16.3.0 + TypeScript 6.0.3 compatibility build;
- Web and Worker runtime smoke;
- full verification chain.

Final process audit found no remaining `curl` probe, `pnpm fetch`, or `pnpm install` process.

### Human-assisted dependency recovery completion

The prior BLOCKED state was later cleared without changing registry policy, dependency versions, manifests, or lockfile resolutions:

| Check | Result |
|---|---|
| runtime | Node `24.19.0`; pnpm `11.21.0` |
| proxy route | loopback proxy at `127.0.0.1:10808`; no credential recorded |
| effective registry | `https://registry.npmjs.org/` |
| exact tarball probe | HTTP 200; 41,543,045 bytes; 5,690,244 bytes/s; 7.306841s; curl exit 0 |
| `pnpm fetch --reporter=append-only` | exit 0 |
| lock SHA-256 before/after fetch | `af3d4651fc3356e68308e113031be08385de60a56cbc9e66bad6d8619ac3d6d7`; unchanged |
| first offline frozen install | exit 0 |
| second offline frozen install | exit 0 |
| normal frozen install | exit 0 |
| `pendingBuilds` | `[]` |
| `allowBuilds` | `{}` |
| required Web/Worker links | present |
| unknown lifecycle/build execution | none |

### Post-install compatibility and runtime findings

The first Web build compiled application code but strict type checking found that Next 16.3.0 types use `PromiseWithResolvers`, while the Web tsconfig exposed only ES2023 declarations. TypeScript 6.0.3 itself provides that declaration in `lib.es2024.promise.d.ts`. The scoped fix added only `ES2024.Promise` to the Web `lib` list; target, dependency versions, strict options, `skipLibCheck: false`, and Next configuration were unchanged. The repeated production build then passed without installing or requesting TypeScript 7.

The first Worker smoke reached the shutdown assertion but exposed Windows signal semantics: `child.kill("SIGTERM")` forcibly terminated the child and returned a null exit code without running its handler. The smoke was changed to use an explicit test-only IPC channel that makes the running child emit its registered SIGTERM event. The final smoke proved the same production shutdown handler, server close, shutdown log, and exit 0. No external service or side effect was introduced.

The first post-build root lint scanned generated `apps/web/.next/**` and `apps/worker/dist/**` outputs because root-only ignore patterns did not cover workspace directories. The ignores were corrected to workspace-recursive generated-output patterns. No lint rule was disabled or weakened, and the repeated lint passed.

## 10. Validation

Original pre-install validation:

| Check | Exit | Result |
|---|---:|---|
| direct ESLint CLI, first pass | 1 | four new Web-smoke issues found |
| direct ESLint CLI after scoped fixes | 0 | PASS without weakening rules |
| direct boundary checker | 0 | 8 workspaces, 16 source inputs, 1 manifest edge |
| direct boundary self-test | 0 | positive 0, negative 1, 12 violations |

Post-install validation:

| Check | Exit | Result |
|---|---:|---|
| first Web production build | 1 | application compile passed; missing `ES2024.Promise` declaration identified |
| Web production build after scoped lib fix | 0 | Next 16.3.0 + TypeScript 6.0.3 PASS; `/`, `/login`, and `/app/today` generated |
| Web production HTTP smoke | 0 | `/login` 200; `/app/today` 200 |
| Worker TypeScript build | 0 | strict compile PASS |
| first Worker smoke | 1 | Windows hard-termination behavior identified; no false PASS claimed |
| Worker smoke after test-only IPC fix | 0 | health 200; fake job completed; SIGTERM handler; graceful exit 0 |
| `pnpm lint` | 0 | PASS after excluding generated workspace outputs; rules unchanged |
| `pnpm typecheck` | 0 | 8/8 workspace tasks PASS |
| `pnpm boundary` | 0 | 8 workspaces, 16 source inputs, 1 manifest edge |
| `pnpm boundary:test` | 0 | positive exit 0; negative exit 1; 12 expected violations |
| `pnpm verify` | 0 | lint, typecheck, boundary, self-test, Web/Worker tests, and build graph PASS |

The unified verify independently reran the Web build and both runtime smokes. Its Web smoke returned `/login` 200 and `/app/today` 200; its Worker smoke returned health 200, fake-job completion, and graceful exit 0.

## 11. Stage 2 Checker Technical Debt

### A. Type-only manifest semantics

The checker does not separately model runtime dependency sections versus type-only manifest permission. This must be resolved or frozen before Stage 4 activates a Contracts type-only edge.

### B. Specifier-level type imports

The canonical safe style remains:

```ts
import type { Foo } from "@xiangxu/contracts";
```

Before Stage 4, enforcement must explicitly address:

```ts
import { type Foo } from "@xiangxu/contracts";
```

Stage 3 does not use either Contracts type-only edge.

## 12. Acceptance Summary

Passed: exact runtime, pre/post handoff integrity, dependency approval/version precision, official-registry fetch, unchanged lockfile, offline and normal frozen installs, empty pending/allowed builds, required dependency links, Next 16.3.0 + TypeScript 6.0.3 compatibility, App Router production build, Web production server and both HTTP routes, Worker build/health/fake-job/graceful shutdown, strict workspace lint/typecheck, boundary and self-test, unified verify, lifecycle/peer/license audits, no unknown lifecycle execution, no external Worker side effect, and Stage 4/5/Gate 4.1 non-entry.

All Stage 3 Acceptance Criteria are proven. No Stage 4 implementation was started.

## 13. Closure Condition

Stage 3 is complete. Stop after this PASS. Stage 4 requires a separate explicit human approval and was not started by this work.

## 14. Final Status

```text
Stage 3 PASS — Stage 4 not started.
Gate 4.1 not started.
```
