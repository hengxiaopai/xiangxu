# XIANGXU Gate 4.1 — Stage 0 Dependency and Contract Decision

Date: 2026-08-12
Authorized scope: dependency resolution, ADR/contract clarification, boundary planning
Status: **PASS**
Business source, business migration, product UI, commit and push: **not performed**

## 1. Decision

Recovery A resolved the original pnpm observability problem and produced the
authoritative candidate graph in an isolated sandbox. Direct pnpm access is
intermittent: three metadata probes completed, while the Playwright probe and
direct resolver timed out on the Playwright dependency chain. Reusing the same
official Registry through the already configured process-local proxy completed
resolution deterministically.

The exact native/lifecycle graph received human review. `fsevents@2.3.2` may
remain as a Darwin-only optional lock record but its lifecycle is denied.
Rolldown 1.2.3 and Lightning CSS 1.33.0 exact precompiled platform artifacts
are approved without build lifecycle permission. The full audit, Playwright
dry-run, deterministic main-workspace integration, native tooling smoke,
path-aware boundary fixtures, frozen installation and unified verification all
passed. Stage 0 adds no business source, migration, product UI, commit or push.

## A. Dependency resolution evidence

Baseline:

| Item | Evidence |
| --- | --- |
| Node | `E:\sofeware\node-v24.19.0-win-x64\node.exe --version` -> `v24.19.0` |
| pnpm | explicit bundled command -> `11.21.0`; PATH pnpm is an unsafe `9.0.2` and was not used |
| Registry | project `.npmrc` and workspace config use `https://registry.npmjs.org/` |
| Initial lock SHA-256 | `46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79` |
| Handoff | 32/32 manifest entries verified before material work |

Attempt 1:

```text
pnpm 11.21.0 install --lockfile-only --ignore-scripts
result: no stdout/stderr; terminated by timeout after 94 seconds
```

Attempt 2, reduced network concurrency and retries:

```text
pnpm 11.21.0 install --lockfile-only --ignore-scripts \
  --network-concurrency=1 --fetch-retries=0 --reporter=append-only
result: no stdout/stderr; terminated by timeout after 94 seconds
```

Both attempts left `pnpm-lock.yaml` at the initial SHA-256 and did not change
`node_modules/.pnpm/lock.yaml`. The official Registry responded successfully to
direct metadata requests. The npm fallback failed before resolution with
missing bundled modules `walk-up-path` and `semver/functions/satisfies`.

### Recovery A — observable resolver

Configuration evidence:

| Item | Result |
| --- | --- |
| `pnpm config get registry` | official `https://registry.npmjs.org/` |
| pnpm `https-proxy` / `http-proxy` | not configured |
| process `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` | not configured before Recovery |
| pnpm `store-dir` | not configured; Recovery used a new isolated store |
| Windows proxy | configured local Xray endpoint; no credential recorded |

Four direct `pnpm view` probes:

| Package | Exit | Elapsed | Result |
| --- | ---: | ---: | --- |
| `@tanstack/react-query@5.101.4` | 0 | 5.069 s | `5.101.4` |
| `uuid@14.0.1` | 0 | 1.790 s | `14.0.1` |
| `@playwright/test@1.62.0` | 124 | 12.035 s | no output; timed out |
| `vitest@4.1.10` | 0 | 7.175 s | `4.1.10` |

An archive of exact commit
`a3183a026fea893b66c7b72dd65ce0f15d7fa572` was expanded into an OS-temporary
sandbox without `node_modules`, build output, Handoff, or browser cache. The
resolver used a separate temporary pnpm store.

Direct observable resolution emitted NDJSON continuously, then exited 1 after
34.5 seconds with:

```text
ERR_PNPM_BROKEN_METADATA_JSON
@playwright/test@1.62.0 -> playwright@1.62.0 -> playwright-core@1.62.0
The operation was aborted due to timeout
```

Resolver Path B set `HTTP_PROXY` and `HTTPS_PROXY` only for the pnpm process.
The official npm Registry remained unchanged. With the same sandbox and
isolated store, lockfile-only resolution completed in 18.9 seconds with
`resolution_done`, `importing_done`, `ignored-scripts: []`, and exit 0.

Root-cause classification:

```text
Node/pnpm direct network path instability
not npm Registry unavailability
recovery used a process-local proxy; official Registry unchanged
```

This evidence does not claim a more specific ISP, TLS, CDN, or operating-system
root cause.

Approved exact direct dependency placement remains:

| Dependency | Owner | Decision |
| --- | --- | --- |
| `@tanstack/react-query@5.101.4` | `apps/web` production | approved, not added while blocked |
| `uuid@14.0.1` | `apps/web` production | approved only for browser/offline UUIDv7, not added while blocked |
| `@playwright/test@1.62.0` | root/testing QA | approved Chromium-only, not added while blocked |
| `vitest@4.1.10` | root/testing QA | existing approval, not added while blocked |
| `@types/pg@8.20.0` | infrastructure dev | not required yet; current direct `pg` import is JavaScript `.mjs` |

## B. License and lifecycle delta

Official npm metadata established this direct/known-immediate set:

| Package | License | Runtime dependencies | Consumer install lifecycle | Other observation |
| --- | --- | --- | --- | --- |
| `@tanstack/react-query@5.101.4` | MIT | `@tanstack/query-core@5.101.4` | no preinstall/install/postinstall | no native binary |
| `@tanstack/query-core@5.101.4` | MIT | none | no preinstall/install/postinstall | no binary |
| `uuid@14.0.1` | MIT | none | no preinstall/install/postinstall observed | package metadata has source `prepare`; CLI bin is JavaScript |
| `@playwright/test@1.62.0` | Apache-2.0 | `playwright@1.62.0` | none | JavaScript CLI bin |
| `playwright@1.62.0` | Apache-2.0 | `playwright-core@1.62.0`; optional `fsevents@2.3.2` | none | browser binaries are acquired only by explicit CLI command |
| `playwright-core@1.62.0` | Apache-2.0 | none | none | browser-aware JavaScript CLI |
| `vitest@4.1.10` | MIT | `vite@8.2.1` plus Vitest packages | no consumer install script shown in direct metadata | Vite uses approved `esbuild@0.28.2`, but introduces separate native packages |

All observed tarball URLs use the official Registry and carry sha512 integrity
metadata. Safe materialization with `--frozen-lockfile --ignore-scripts`
completed with 236 current-platform packages and exit 0. No lifecycle was
executed. Candidate package records use the following license families:
`0BSD`, `Apache-2.0`, `Apache-2.0 AND LGPL-3.0-or-later`, `BlueOak-1.0.0`,
`BSD-2-Clause`, `BSD-3-Clause`, `CC-BY-4.0`, `ISC`, `MIT`; the separately
verified Lightning CSS packages use `MPL-2.0`.

New blockers found before completing the full graph approval:

| Exact path | License / platform | Lifecycle or binary | Reachability | Decision |
| --- | --- | --- | --- | --- |
| root dev `@playwright/test@1.62.0 -> playwright@1.62.0 -> optional fsevents@2.3.2` | MIT; `os: darwin`; `gypfile: true` | `install: node-gyp rebuild`, produces native `fsevents.node` | QA/dev only; skipped on Windows but retained in lock | presence approved; exact lifecycle denied with `allowBuilds: false` |
| root dev `vitest@4.1.10 -> vite@8.2.1 -> rolldown@1.2.3 -> @rolldown/binding-win32-x64-msvc@1.2.3` | MIT; Windows x64 | prebuilt `.node` binding | QA/dev via Vitest | exact precompiled platform family approved; no `allowBuilds` entry |
| root dev `vitest@4.1.10 -> vite@8.2.1 -> lightningcss@1.33.0 -> lightningcss-win32-x64-msvc@1.33.0` | MPL-2.0; Windows x64 | prebuilt `.node` binding | QA/dev via Vitest | exact precompiled platform family approved; no `allowBuilds` entry |

The lock records 14 exact `@rolldown/binding-*@1.2.3` variants and 11 exact
`lightningcss-*@1.33.0` variants. Every record has official Registry integrity,
no preinstall/install/postinstall, `requiresBuild=false`, and explicit
OS/CPU/libc gating where applicable. The supported targets resolve to:

The complete per-record metadata, tarball and integrity inventory is retained
in `docs/codex/GATE_4_1_STAGE_0_NATIVE_PLATFORM_AUDIT.json`.

| Target | Rolldown | Lightning CSS |
| --- | --- | --- |
| Windows x64 | `@rolldown/binding-win32-x64-msvc@1.2.3` | `lightningcss-win32-x64-msvc@1.33.0` |
| Ubuntu 24.04 x64 glibc | `@rolldown/binding-linux-x64-gnu@1.2.3` | `lightningcss-linux-x64-gnu@1.33.0` |

No fourth esbuild version appeared: the graph retains only
the already approved `0.18.20`, `0.25.12`, and `0.28.2`. No new `allowBuilds`
entry was added or inferred.

## C. Lockfile delta

The pre-integration main-workspace lock SHA-256 was
`46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79`.

The isolated candidate lock SHA-256 is
`68c2132a6db9d40cad6a176d64a6dafa03d41cb56c873cd1779359fe154fcd10`.
Its `packages` section contains 375 exact package records versus the baseline
311, with 64 new exact package records. The
candidate dependency graph was reproduced exactly in the main workspace. After
the approved source-scoped `apps/web -> @xiangxu/infrastructure` workspace link
was added, only that importer changed: candidate and final `packages` and
`snapshots` section hashes remain identical. Final main lock SHA-256:
`820eeafe0719ee3bfc59b3c274a4057a0cf5093d604192107fb1b86985808a19`.

## D. Playwright dry-run browser provenance

Executed after the complete dependency/native audit, with no browser download:

```text
Playwright: 1.62.0
Chrome for Testing / Headless Shell: 151.0.7922.34
Playwright Chromium revision: 1234
Cache: C:\Users\Administrator\AppData\Local\ms-playwright
Primary source: https://cdn.playwright.dev/
Official fallback: https://playwright.download.prss.microsoft.com/
Custom PLAYWRIGHT_DOWNLOAD_HOST: not configured
Custom PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: not configured
```

The dry-run also listed Playwright-managed FFmpeg revision 1011 and Winldd
revision 1007 from the same official distribution infrastructure. Exit was 0.
The approved future browser acquisition sequence remains:
sequence remains:

```text
pnpm exec playwright install --dry-run chromium
pnpm exec playwright install chromium                    # local
pnpm exec playwright install --with-deps chromium        # CI
```

The dry-run must record exact Chromium revision and official Playwright browser
distribution URL before actual acquisition. Firefox, WebKit, Chrome and Edge
remain forbidden.

## E. Revision/HTTP concurrency ADR

The required decision is recorded in
`docs/codex/ADR-G4.1-001-REVISION-HTTP-CONCURRENCY.md`. It freezes branded
`bigint` inside Domain/Application, canonical positive decimal strings in JSON
and UI, strong `"rev-N"` validators, and 428/400/412 behavior. No Domain code
was created.

## F. Updated Gate 4.1 contract decisions

- Dev UI route remains `/login`.
- Dev transport is only `POST /api/dev/session` and
  `DELETE /api/dev/session`; it is not under `/api/v1`.
- Production makes dev-session unavailable and fail-closed.
- Server selects the deterministic dev user. Browser actor/user/owner values
  are untrusted.
- Session token is a random opaque secret; PostgreSQL stores only its hash.
- No Proposal public revision or Proposal ETag exists.
- Gate 4.1 raw capture is text-only and retains immutable raw payload identity.
- Realtime reads committed durable PostgreSQL events; Worker never emits SSE
  directly.

## G. Revised TimeBlock fixture

Frozen distinctions: Task due is not TimeBlock schedule, and neither is an
ExecutionRecord actual interval.

Fixture `locked replan`:

1. An active/planned Task TimeBlock exists with `locked=true`.
2. An AI/system Replan proposes a move using the current target base revision.
3. Apply returns `TIMEBLOCK_LOCKED`.
4. TimeBlock revision is unchanged; no ChangeRecord or Outbox row is written.

Fixture `explicit user move`:

1. The same locked block is moved by the explicit user command with current
   ETag/CAS.
2. The move is allowed if no Application overlap conflict exists.
3. A successful mutation increments revision and atomically writes
   ChangeRecord and Outbox.

Fixture `overlap`:

1. Same owner/actor has an active/planned Task TimeBlock.
2. The candidate interval overlaps it.
3. Application returns `TIMEBLOCK_CONFLICT`; no mutation/audit/outbox occurs.
4. A transaction-scoped advisory lock may serialize the check. No global
   PostgreSQL `EXCLUDE` constraint is introduced.

## H. Revised Proposal CAS model

Proposal content is immutable and follows the frozen schema. Apply performs:

1. authorize explicit R2 confirmation;
2. load Proposal and require status `ready` through a guarded status transition;
3. refresh every target Fact and compare stored `base_revisions`;
4. recompute permissions, risk and Application policies, including locked
   TimeBlocks;
5. execute Fact commands through Application boundaries;
6. atomically persist Fact revisions, ChangeRecord, Outbox, and Proposal
   `ready -> applied` transition.

If status is no longer `ready`, target revision is stale, or a policy fails,
nothing is silently overwritten. Adjustment creates a new version/child
Proposal and never mutates applied history.

## I. Revised raw-payload physical model

Planned physical support table, not migrated in Stage 0:

```text
capture.raw_payloads
  id UUIDv7 primary key
  owner_id UUID not null
  kind text check kind = 'text'
  text_content text not null
  content_hash text not null
  created_at timestamptz not null

capture.capture_items.raw_payload_ref
  -> capture.raw_payloads.id
```

The raw payload is immutable source Fact. Gate 4.1 does not add S3/object
storage and does not replace `raw_payload_ref` with `raw_text`.

## J. Revised Outbox/SSE architecture

```text
Worker -> Application Command -> PostgreSQL transaction
       -> Fact/Proposal + ChangeRecord + Outbox

SSE endpoint -> committed durable event/outbox sequence
             -> bounded PostgreSQL polling + heartbeat
             -> EventSource browser
```

`Last-Event-ID` replays committed event sequence within a bounded retention
window. Gaps outside that window produce `system.resync-required`. BullMQ is
execution infrastructure only; Redis Pub/Sub is not required. SSE payloads
carry refs, decimal-string revisions and projection hints, not sensitive text.

## K. Server composition-root boundary

The boundary checker now classifies source paths instead of granting the entire
Web workspace a broad edge:

| Source | Infrastructure edge |
| --- | --- |
| `apps/web/src/server/composition/**` | may import the public `@xiangxu/infrastructure` entry point |
| all other `apps/web` source | forbidden |
| any file in a client dependency chain or containing `"use client"` | forbidden, even if misplaced under the server directory |

The manifest declares the workspace edge only after path-aware enforcement.
Fixtures prove server composition positive, client dependency-chain negative,
non-composition server negative, and deep infrastructure import negative. No
real composition root or business adapter was created.

## L. Updated bounded Stage 1–9 plan

| Stage | Bounded outcome | Entry condition |
| --- | --- | --- |
| 1 | contract schemas/OpenAPI and pure Domain revision/value policies; no infrastructure implementation | explicit Stage 1 authorization after Stage 0 PASS |
| 2 | additive reviewed migration and infrastructure repository/UoW foundation | Stage 1 PASS |
| 3 | dev-session transport and Create/Complete Task vertical slice through Application boundaries | Stage 2 PASS |
| 4 | TimeBlock commands, advisory serialization and locked/overlap fixtures | Stage 3 PASS |
| 5 | raw Capture, deterministic structured Proposal mock, guarded Apply, worker Application-command path | Stage 4 PASS |
| 6 | durable outbox dispatch, bounded SSE replay, exact TanStack invalidation, native IndexedDB Quick Capture | Stage 5 PASS |
| 7 | Review snapshot and bounded product routes/states using frozen tokens | Stage 6 PASS |
| 8 | unit/contract/integration/Chromium E2E, accessibility and visual evidence | Stage 7 PASS |
| 9 | clean rebuild, unified CI, evidence report and publication decision; no automatic push | Stage 8 PASS |

No later stage may be pulled forward to make an earlier stage pass.

## Final verification

- Script-off and normal `pnpm install --frozen-lockfile`: PASS.
- Explicit lifecycle governance: three exact esbuild versions true;
  `msgpackr-extract@3.0.4` and `fsevents@2.3.2` false.
- Native tooling smoke: Vitest 4.1.10, Vite 8.2.1, Rolldown 1.2.3 and
  Lightning CSS 1.33.0 loaded on Windows x64; CSS transform output verified.
- `pnpm boundary`: PASS — 8 workspaces, 34 source files, 3 manifest edges.
- `pnpm boundary:test`: PASS — positive exit 0, negative exit 1, 59 expected
  violation records.
- `pnpm verify`: PASS, including PostgreSQL 18.4, Redis 8.2.8, BullMQ fake-job
  smoke and deterministic infrastructure cleanup.
- Handoff SHA-256: 32/32 before work; final check recorded at closure.
- No business implementation, migration, product UI, browser download,
  commit, or push.

```text
Gate 4.1 Stage 0 PASS —
Stage 1 not started.
Gate 4.2 not started.
```
