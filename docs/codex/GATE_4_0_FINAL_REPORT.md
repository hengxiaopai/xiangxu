# XIANGXU Gate 4.0 Final Audit Report

Date: 2026-08-12
Scope: Gate 4.0 engineering bootstrap only
Phase: Stage 8 / Phase A — Final Local Gate Audit
Status: **LOCAL AUDIT PASS; FINAL PUBLICATION AUTHORIZED; EXTERNAL CLOSURE PENDING**
Gate 4.1: **not started**

## 1. Final Decision at This Checkpoint

The Stage 8 local audit passed. The repository can be rebuilt and verified from
the approved dependency graph, all Stage 0–7 evidence remains continuous, and
the Stage 7 browser evidence is internally consistent.

Gate 4.0 is not finally closed by the local report alone. Final publication was
explicitly authorized after Phase A; the authoritative final state is
established externally by proving that `origin/main` and the successful GitHub
Actions `head_sha` both equal the exact final Gate commit. Until that proof
exists, the formal state is:

```text
Stage 8 BLOCKED — final publication and exact-commit Hosted CI closure pending.
Gate 4.1 not started.
```

This is an external-evidence checkpoint, not an engineering verification
failure. Phase A performed no commit, push, tag, release, pull request, or Gate
4.1 work. The later final-publication authorization permits only the reviewed
Stage 7/8 commit, a normal push to `origin/main`, and exact-commit Hosted CI.

## 2. Gate Scope and Non-Goals

Gate 4.0 remains an engineering skeleton. Stage 8 added no product feature,
business code, authentication, Task/Calendar/Inbox/Proposal implementation,
AI/provider/connector integration, business database table, real queue, design
system component, or dependency.

The final repository contains only the approved Web and Worker shells,
transport-contract foundation, semantic UI/token foundation, infrastructure
sentinel, deterministic fake queue smoke, verification policy, and browser
evidence.

## 3. Baseline and Git State

| Item | Audited value |
| --- | --- |
| Repository | `hengxiaopai/xiangxu` |
| Local `HEAD` | `d568729f6f314fa00ff69266fe2932a680a041ac` |
| `origin/main` | `d568729f6f314fa00ff69266fe2932a680a041ac` |
| Stage 6 successful checkpoint CI | run `31553374868` for the published Stage 6 final checkpoint, as supplied by the Stage 7/8 approval record |
| Stage 6 corrective hosted proof retained in repository | run `31553121149`, commit `964a965dfd6b6161c3a55f30fc557b255a68fea1`, `ubuntu-24.04` |
| Stage 7 | PASS; local-only; uncommitted; unpushed |
| Final Stage 7/8 publication commit | established by the publication event; not self-written into this commit |
| Final Hosted CI run | external closure evidence for the exact publication SHA |

The worktree delta from `d568729` is fully explained by Stage 7 evidence and
tooling plus this Stage 8 report/status update:

- Stage 7: eight PNG files, screenshot manifest, trusted-keyboard JSON, two
  deterministic verifier scripts, two root commands, Stage 7 evidence report,
  and Stage 7 status changes in `AGENTS.md`/`README.md`.
- Stage 8: this final report and the publication-checkpoint status changes in
  `AGENTS.md`/`README.md`.
- Unexplained changes: zero.

The Handoff directory is ignored and absent from the 142 current publication
candidate files. Nothing was staged.

## 4. Stage 0–7 Evidence and Status Continuity

| Stage | Final state | Evidence continuity |
| --- | --- | --- |
| Stage 0 — Environment and Dependency Review | PASS | Exact runtime/dependency decisions and unresolved-at-that-time lifecycle review recorded in `VERSIONS_LOCK.md` and `DEPENDENCY_REVIEW.md`. |
| Stage 1 — Repository Governance | PASS | Bootstrap, registry, exact versions, frozen installation and governance evidence retained. |
| Stage 2 — Layering | PASS | Real boundary matrix plus positive/negative fixtures retained. |
| Stage 3 — Runtime Shells | PASS | Initial dependency acquisition BLOCKED, unsuccessful Recovery, human-assisted dependency recovery, corrective build/type work, and final PASS all retained. |
| Stage 4 — Contracts and UI | PASS | Deterministic contract generation, drift proof, semantic tokens and minimal components retained. |
| Stage 5 — Data and Queue | PASS | Lifecycle BLOCKED, dependency/lifecycle approvals, Recovery, clean rebuild issue and final PostgreSQL/Redis/BullMQ PASS retained. |
| Stage 6 — Unified Verification and CI | PASS | Initial publication BLOCKED, first hosted failure `31552743256`, minimal type-generation fix, corrective success `31553121149`, and later published checkpoint evidence retained. |
| Stage 7 — Browser and Visual Evidence | PASS | Trusted Enter initially BLOCKED, Computer Use fail-closed behavior, rejected CDP route, approved Chrome capability Recovery, and final evidence PASS retained. |

The state chain contains no skipped stage and does not erase earlier BLOCKED or
Recovery events. Those events are governance evidence.

## 5. Runtime, Registry, Dependencies, and Lockfile

| Control | Result |
| --- | --- |
| Node | `v24.19.0` PASS |
| pnpm | `11.21.0` PASS |
| Node first resolution | `E:\sofeware\node-v24.19.0-win-x64\node.exe` |
| pnpm first resolutions | `E:\sofeware\node-v24.19.0-win-x64\pnpm` and `.CMD` |
| Registry | project-level `https://registry.npmjs.org/` PASS |
| Production/root manifest count | 9 workspace manifests |
| Direct manifest entries | 22 |
| Non-exact external direct versions | 0 |
| Direct external git/http/file/link sources | 0 |
| Internal workspace links | approved `workspace:*` links only |
| Unknown production dependencies | 0 |
| Lock SHA-256 | `46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79` |

The final reviewed versions include `next@16.3.0`, `react@19.2.8`,
`typescript@6.0.3`, `zod@4.4.3`, `drizzle-orm@0.45.2`,
`drizzle-kit@0.31.10`, `pg@8.23.0`, `bullmq@6.0.10`, and
`ioredis@5.11.1`.

`pnpm install --frozen-lockfile` passed under the exact runtime and reported the
workspace already up to date. The lock hash did not change.

## 6. Lifecycle Governance

The final policy remains exactly:

```yaml
allowBuilds:
  'esbuild@0.18.20': true
  'esbuild@0.25.12': true
  'esbuild@0.28.2': true
  'msgpackr-extract@3.0.4': false
```

- A fourth approved lifecycle package does not exist.
- `dangerouslyAllowAllBuilds` is absent.
- `node_modules/.modules.yaml` records `pendingBuilds: []` and
  `ignoredBuilds: []`.
- `pnpm ignored-builds` reports no automatically ignored builds and the exact
  explicitly denied `msgpackr-extract@3.0.4`.
- `esbuild@0.18.20` remains transitive development tooling only; its serve
  capability is forbidden.
- The `msgpackr-extract@3.0.4` native lifecycle remains denied; the BullMQ smoke
  uses the verified pure-JavaScript path.

## 7. Architecture and Boundary Proof

`pnpm boundary` passed for 8 workspaces, 34 production source files, and 2 real
manifest edges. `pnpm boundary:test` proved the positive fixture passes and the
negative fixture raw-check fails with all 56 expected violation records.

The final matrix continues to enforce:

- Domain: pure TypeScript; no React, Zod, database, Redis, BullMQ,
  Infrastructure, or provider SDK.
- Application: no database or BullMQ implementation.
- Contracts: transport/schema foundation only.
- UI: semantic components and tokens only; no database/provider dependency.
- Web: no direct database, Redis, BullMQ, authentication, or provider access.
- Infrastructure: the only package permitted to implement PostgreSQL, Redis,
  Drizzle, and BullMQ integration.

A production-source scope scan found no Task, Calendar, Inbox, Proposal,
provider, AI, authentication, scheduler, or business workflow implementation.
Matches were limited to guardrail text in nested `AGENTS.md` files.

## 8. Contracts and UI/Token Results

The OpenAPI artifact was generated twice. The pre-generation, first-generation,
and second-generation SHA-256 were identical:

```text
cc6db61a0e48f3a7f0789ad5a40128f2dd92c885e409142ea7848c7d9b642e33
```

`pnpm contracts:check` passed byte stability and
`pnpm contracts:drift:test` proved a temporary mutation is rejected with raw
exit 1. The OpenAPI document still has `paths: {}` and no business endpoint.

`pnpm tokens:check` passed across 11 files. Primitive raw token values remain
confined to `packages/ui/src/tokens.css`; Light/Dark semantic tokens, Button and
Surface remain the only UI foundation, and Web has no second token registry.

## 9. Web, Worker, Persistence, and Queue

The unified verification proved:

- Next.js 16.3.0 production build PASS; `/`, `/login`, and `/app/today` are
  static shell routes; Web HTTP smoke PASS.
- Worker TypeScript build, health response, deterministic fake job, and graceful
  shutdown PASS.
- PostgreSQL image/version PASS at 18.4.
- Redis image/version and PONG PASS at 8.2.8.
- Migration count remains exactly 1.
- The only application-owned table is the business-neutral
  `infra_bootstrap_sentinel`; the smoke leaves zero sentinel rows.
- BullMQ still uses only `xiangxu-infra-smoke` / `xiangxu-stage5` with fake job
  ID `stage5-fake-job`, payload `{ kind: "infrastructure-smoke", value: 7 }`,
  deterministic result value 14, and cleanup by exact queue identity.
- No task, proposal, AI, or provider queue exists.

## 10. Stage 7 Browser Evidence

`pnpm browser:check` and `pnpm browser:evidence` passed after the final frozen
install and unified verification. The manifest verifies all eight PNG files:

| Route | Viewport/theme | SHA-256 |
| --- | --- | --- |
| `/login` | desktop light | `fac9704efe424ae765ca334dd3b08722572c8c180403ccc52558e9d6fde6ef8c` |
| `/login` | desktop dark | `0a286477765b4ff30bf0cc6c50ee75471d54f508b207a3078d967c16512046e1` |
| `/login` | mobile light | `547bfc29d397358e719b0ee01d3bc249fc6c95e43a47890615d0dc85e4440ccc` |
| `/login` | mobile dark | `413a87d0d150a352c674a973914f12d1b10fa08ec39596aa7c63fc2e7b50f51e` |
| `/app/today` | desktop light | `fa455298f6d4fad7215ead4e5ada686591864771fb3b31aa4e9a444c2a367a65` |
| `/app/today` | desktop dark | `7d5daf6639a01bf7abefa5cb2da09ee9cd060c0694916dbb2d902e1bebd2e658` |
| `/app/today` | mobile light | `31781ee8cfd3a717bc6ba00682ec7b4bbb1b08c5e16d5b46af353f458f6efbaf` |
| `/app/today` | mobile dark | `10f57c1bf77f3c655b853982c57eae524446828687d59cb8f7b899f6fc9fb322` |

Across all cases: console errors 0, page errors 0, failed requests 0, external
requests 0, horizontal overflow false, and clipped element count 0.

Keyboard evidence proves Tab PASS, Shift+Tab PASS, focus-visible outline PASS,
and the trusted browser-level sequence:

```text
Tab → Login shell → trusted Enter → /login
```

The disabled login button remains outside the Tab order, Enter causes no auth
request, `/login` has no form or credential input, and both routes contain no
session-backed or database-backed business behavior. The first Stage 7 BLOCKED
attempt remains recorded because Computer Use correctly failed closed and no
untrusted workaround was accepted.

## 11. Final Local Verification and Cleanup

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS, exit 0 |
| `pnpm boundary` | PASS |
| `pnpm boundary:test` | PASS; negative raw exit 1; 56 violations |
| two `pnpm contracts:generate` runs | PASS; identical bytes |
| `pnpm contracts:check` | PASS |
| `pnpm contracts:drift:test` | PASS; negative raw exit 1 |
| `pnpm tokens:check` | PASS |
| `pnpm verify` | PASS, exit 0, 47.7 seconds |
| `pnpm browser:check` | PASS |
| `pnpm browser:evidence` | PASS |
| XIANGXU containers/volumes/networks after verification | 0 / 0 / 0 |
| listeners on 4327 / 9333 / 55432 / 6379 | 0 / 0 / 0 / 0 |
| Docker Desktop | stopped after audit |

The local PostgreSQL 16 service on port 5432 was not targeted or changed.

## 12. Handoff Integrity

The read-only Handoff manifest contains 32 entries. The Stage 8 pre-operation
verification passed 32/32 with manifest SHA-256:

```text
8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc
```

Final post-operation verification is recorded in Section 16 after all report
and status-file edits. The package remains local-only, read-only, ignored, and
absent from publication candidates.

## 13. Public Repository and Secret Audit

The final pre-publication scan covered all 143 tracked or unignored untracked
candidate files and returned:

```text
Handoff candidates:                    0
suspicious credential/runtime files:  0
high-confidence secret matches:       0
publishable violations:               0
```

No `.env` runtime file, private key, certificate/key store, database dump,
archive, API key, or temporary credential is a publication candidate. Eight
files contain absolute local paths, but every match is confined to historical
`docs/codex/` execution evidence; production runtime code has no absolute local
path dependency. Browser artifacts contain only the approved local skeleton and
technical metadata, not personal or business data.

## 14. Historical Blockers and Recoveries

The final record deliberately retains:

- Stage 3 dependency acquisition and runtime-shell recovery history.
- Stage 5 native lifecycle denial, explicit approvals, and recovery history.
- Stage 6 publication checkpoint, first hosted typecheck failure, minimal fix,
  and successful hosted recovery.
- Stage 7 trusted-input blocker, security-policy fail-closed behavior, rejected
  CDP route, and browser-capability recovery.

No acceptance test, strict compiler option, boundary rule, lifecycle policy, or
security restriction was weakened to convert a BLOCKED state into PASS.

## 15. Known Technical Debt, Restrictions, and Deferred Work

- `esbuild@0.18.20` is transitive tooling with a dev-server advisory. Its serve
  capability remains forbidden.
- `msgpackr-extract@3.0.4` native lifecycle is explicitly denied. BullMQ is
  proven only through the pure-JavaScript path.
- Browser evidence is Gate-level smoke, not WCAG certification, exhaustive
  assistive-technology testing, cross-browser certification, or a
  cross-platform pixel-perfect baseline.
- OpenAPI contains no business endpoints.
- PostgreSQL contains only the infrastructure sentinel; it is not a business
  persistence model.
- The Web and Worker are shells. Authentication, domain entities, commands,
  idempotency/revision controls, real queues, provider adapters, connectors,
  and product workflows are deferred to an explicitly approved later Gate.
- At Phase A report authoring, Hosted CI evidence proved the Stage 6 published
  baseline; the Stage 7/8 exact-commit Hosted run is intentionally external
  closure evidence produced only after this report is committed and pushed.

## 16. Final Integrity and Publication Fields

```text
Handoff post-operation SHA audit: 32 / 32 unchanged; manifest SHA-256 8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc
Final publication commit:         external closure evidence; publication authorized
Final origin/main:                must equal the external final commit SHA
Final Hosted CI run:              must use that exact SHA as Actions head_sha
Final Hosted CI conclusion:       must be completed / success
```

Final publication SHA and its successful Hosted Runner constitute external
closure evidence. The authoritative final state is established after
publication by proving `origin/main == Actions head_sha` and workflow
`conclusion == success`. The SHA and Run ID are intentionally not written back
into this same commit, because doing so would create a new commit and an
unbounded self-reference loop. Only the completed external chain can produce:

```text
Gate 4.0 PASS — Gate 4.1 not started.
```

Until that external proof exists:

```text
Stage 8 publication authorized —
awaiting exact final commit Hosted CI closure.
Gate 4.1 not started.
```
