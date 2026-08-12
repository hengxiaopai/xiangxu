# XIANGXU Gate 4.0 / Stage 5 Data & Queue Evidence

> Stage: Gate 4.0 / Stage 5 — Data & Queue Foundation  
> Audited at: 2026-08-12  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 5 PASS**  
> Stage 6: not started  
> Gate 4.1: not started

## 1. Result and Scope

Stage 5 establishes only PostgreSQL 18.4, a Drizzle versioned-migration
foundation, Redis 8.2.8, and one BullMQ infrastructure fake-job smoke. The
database contains one non-business sentinel table with `id` and `created_at`.
No Task, Calendar, Inbox, Proposal, User, authentication, AI, provider,
connector, business queue, or production business table was created.

```text
Stage 5 PASS — Stage 6 not started.
Gate 4.1 not started.
```

## 2. Runtime, Integrity, and Docker Gate

| Check | Verified result |
|---|---|
| Node | `v24.19.0` |
| pnpm | `11.21.0` |
| selected Node | `E:\sofeware\node-v24.19.0-win-x64\node.exe` |
| selected pnpm | `E:\sofeware\node-v24.19.0-win-x64\pnpm.CMD` |
| registry | `https://registry.npmjs.org/` |
| handoff before Stage 5 material work | `32 / 32 SHA-256 unchanged` |
| handoff after Stage 5 material work | `32 / 32 SHA-256 unchanged` |
| Docker Desktop | `4.85.0 (235549)` |
| Docker Engine | `29.6.2`, Linux/amd64 daemon |
| Docker Compose | `v5.3.1` |

An initial nested root-script invocation resolved the machine's older Node
22/pnpm 9 and was rejected by the repository engines gate before Drizzle ran.
All accepted commands were then executed with the approved runtime directory
first in the process-local `PATH`; no system installation was changed.

## 3. Dependency and Lifecycle Audit

Only `@xiangxu/infrastructure` owns the Stage 5 direct dependencies:

| Package | Exact version | License | Approval |
|---|---:|---|---|
| `drizzle-orm` | `0.45.2` | Apache-2.0 | Stage 0 |
| `drizzle-kit` | `0.31.10` | MIT | Stage 0 |
| `pg` | `8.23.0` | MIT | Stage 0 |
| `bullmq` | `6.0.10` | MIT | Stage 0 |
| `ioredis` | `5.11.1` | MIT | Stage 5 human approval |

The scripts-disabled resolution and later frozen installation use only the
official npm registry. The final lockfile SHA-256 is:

```text
46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79
```

No Git, file, link, exotic registry, range, or unapproved production
dependency exists in the resolved Stage 5 graph. The complete installed
license inventory contains 189 package records across nine expressions:

| License expression | Records |
|---|---:|
| MIT | 145 |
| Apache-2.0 | 20 |
| ISC | 11 |
| BSD-2-Clause | 6 |
| BSD-3-Clause | 3 |
| 0BSD | 1 |
| BlueOak-1.0.0 | 1 |
| CC-BY-4.0 | 1 |
| Apache-2.0 AND LGPL-3.0-or-later | 1 |

The last three are respectively `minimatch`, `caniuse-lite`, and the existing
Stage 3 Sharp Windows platform package. No unknown license was reported.

Lifecycle governance is exact and deny-by-default:

```yaml
allowBuilds:
  'esbuild@0.18.20': true
  'esbuild@0.25.12': true
  'esbuild@0.28.2': true
  'msgpackr-extract@3.0.4': false
```

`esbuild@0.18.20` is reachable only through the Drizzle Kit development and
migration-tool path; its serve capability is forbidden. Exact Windows x64
optional artifacts and binary versions for all three approved esbuild
versions were verified. `pnpm ignored-builds` reports automatically ignored
builds `None` and explicitly ignored `msgpackr-extract@3.0.4`. The latter's
native lifecycle did not execute; the successful BullMQ smoke proves the
approved pure-JavaScript path is sufficient.

The lifecycle recovery history is retained: the first approved-esbuild frozen
install failed closed on previously unreviewed `msgpackr-extract@3.0.4` with
`ERR_PNPM_IGNORED_BUILDS`. Human decision then explicitly denied that exact
native lifecycle. With the exact `false` rule applied,
`pnpm install --frozen-lockfile` exited `0` without dependency re-resolution,
native compilation, fallback download, or new lifecycle execution.

## 4. Docker Images and Isolation

`compose.yaml` has exactly two services, `postgres` and `redis`. Both host
bindings use `127.0.0.1`; PostgreSQL maps to 55432 and Redis to 6379. No Web,
Worker, reverse proxy, observability, mail, object storage, or AI service is
present.

| Service | Exact pinned image/index digest | Official registry linux/amd64 child digest | Runtime proof |
|---|---|---|---|
| PostgreSQL | `postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382` | `sha256:7e6103cf85f88f7a0eddb3ec0b1ba8940eba098ed118ade25a729ca9daee5568` | healthy; SQL reports PostgreSQL 18.4 |
| Redis | `redis:8.2.8-bookworm@sha256:2f7462b9e93e0a7ae2edf3a0a0babc8a4d29f8bfc50849b906b7caaef925edc1` | `sha256:d9f0312a780ed4ad4c22c05790c20b3902498b563ba01f3f1134678b9bd2f311` | healthy; INFO reports 8.2.8 |

Docker 29.6.2's local image descriptor retains the OCI index digest while
reporting `linux/amd64`; the child manifest values above were resolved from
the official Docker Registry index. Container inspection recorded the exact
pinned references and healthy state.

The machine's existing `postgresql-x64-16` service remained `Running` and
continued listening on 5432 throughout. Stage 5 never stopped, reconfigured,
or connected to it.

## 5. Configuration and Destructive Safety

`.env.example` contains only safe local placeholders. Real smoke credentials
are random per run, written to an OS temporary directory with restrictive
mode, never printed, and deleted afterward. Missing `DATABASE_URL` or
`REDIS_URL`, an invalid protocol, port 5432, a non-loopback host, or a wrong
database name fails closed.

All destructive operations require the exact confirmation token
`--confirm-xiangxu-stage5`, fixed project name `xiangxu-stage5`, fixed local
endpoints, and project volume label. The only removable volume is
`xiangxu-stage5_postgres_data`. No prune, `FLUSHALL`, broad glob, or foreign
volume removal exists.

Negative proof without the confirmation token:

```text
exit 1
Error: Destructive Stage 5 smoke requires --confirm-xiangxu-stage5
post-check XIANGXU containers: 0
post-check XIANGXU volumes: 0
```

## 6. Drizzle Migration Foundation

The only migration source is:

```text
packages/infrastructure/database/schema.ts
  -> drizzle-kit generate
  -> packages/infrastructure/drizzle/0000_motionless_bloodaxe.sql
```

No `push` path or parallel handwritten migration exists. The generated SQL
creates only `infra_bootstrap_sentinel(id, created_at)`.

| Versioned artifact | SHA-256 |
|---|---|
| `0000_motionless_bloodaxe.sql` | `5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe` |
| `meta/_journal.json` | `268d792fa780e75f8ea77bbcabed03ed2a9493b13e566c442d3d51d42a0aee0e` |
| `meta/0000_snapshot.json` | `06b4dba1dd7bb32f5401942440bbcf0c0530659c85e16019caa593aaff98d9ee` |

The second unchanged generation reported `No schema changes, nothing to
migrate`; the same three-file set and every hash remained unchanged.

Drizzle ORM's TypeScript 6 declarations recursively expose unrelated optional
database-driver declarations when the schema is exported as production
runtime source. The schema is therefore correctly classified beside
`drizzle.config.ts` as migration tooling input, not exported by the
Infrastructure runtime package. Global strict options, including
`skipLibCheck: false`, remain unchanged; runtime typecheck is 8/8 PASS, while
the schema is verified by lint, deterministic generation, and real migration.

## 7. Fresh Database and Rebuild Proof

The first rebuild attempt exposed a PostgreSQL official-image initialization
window: Docker health became ready while the temporary init server was about
to switch to the final postmaster, terminating the first migration connection.
Cleanup still removed the container, network, and project volume. The accepted
implementation now requires two SQL identity reads one second apart with the
same `pg_postmaster_start_time()` before migration; it does not trust Docker
health alone.

`pnpm db:rebuild:smoke` then passed two independent cycles:

| Cycle | Starting state | Version | Migration history | SQL round-trip | Ending state |
|---:|---|---|---:|---|---|
| 1 | new empty XIANGXU volume | PostgreSQL 18.4 | exactly 1 | insert/read/delete PASS; rows 0 | project volume deleted |
| 2 | second new empty XIANGXU volume | PostgreSQL 18.4 | exactly 1 | insert/read/delete PASS; rows 0 | project volume deleted |

The migration is also applied twice in the combined smoke; history remains
exactly one entry, proving migrate idempotency and no duplicate migration.

## 8. Redis and BullMQ Pure-JavaScript Smoke

The combined `pnpm infra:smoke` result was:

```json
{
  "redisPing": "PONG",
  "redisVersion": "8.2.8",
  "jobId": "stage5-fake-job",
  "payload": { "kind": "infrastructure-smoke", "value": 7 },
  "result": { "kind": "infrastructure-smoke-result", "value": 14 },
  "state": "completed"
}
```

The dedicated queue is `xiangxu-infra-smoke` under the
`xiangxu-stage5` prefix. One deterministic JSON-safe job was enqueued, received
by a BullMQ Worker, completed, verified, and obliterated. Queue, QueueEvents,
Worker, and direct ioredis health client were closed. HTTP/provider/email/SMS/
AI calls, filesystem business output, and database business mutation were all
zero.

## 9. Architecture and Negative Proof

The boundary matrix grants Drizzle, pg, ioredis, and BullMQ only to
Infrastructure. Domain has zero external permissions; Application, Contracts,
UI, Web, and Worker have no direct Stage 5 data/queue external permission.
Database schema and all Stage 5 scripts are explicit boundary source inputs.

The real checker passed across 8 workspaces, 34 source files, and 2 manifest
edges. The negative fixture raw checker exited `1`; the self-test verified 56
expected violations, including every required Domain, Application, Web, and UI
database/Redis/BullMQ prohibition.

## 10. Commands and Regression Evidence

Accepted commands used the exact runtime and all exited `0`:

```text
pnpm install --frozen-lockfile
pnpm ignored-builds
pnpm lint
pnpm typecheck
pnpm boundary
pnpm boundary:test
pnpm db:generate                 # initial versioned migration
pnpm db:generate                 # no change; hashes stable
pnpm db:rebuild:smoke            # two independent fresh volumes
pnpm infra:smoke                 # DB + Redis + BullMQ
pnpm verify
```

Final `pnpm verify` covered:

```text
lint PASS
strict typecheck 8/8 PASS
boundary PASS
boundary negative self-test PASS (56 expected violations)
contracts check PASS; OpenAPI byte-stable
tokens check PASS
test graph 8/8 PASS
Web production build PASS
/login 200
/app/today 200
Stage 3 Worker health/fake-job/graceful-shutdown PASS
build graph 4/4 PASS
Stage 5 PostgreSQL/Redis/BullMQ smoke PASS
```

`db:rebuild:smoke` remains the separately executed destructive Gate command;
ordinary `pnpm verify` includes the non-rebuild combined infrastructure smoke.

## 11. Terminal State

After all verification and cleanup:

```text
XIANGXU containers: 0
XIANGXU volumes: 0
Stage 5 Node child processes: 0
host port 55432 listeners: 0
host port 6379 listeners: 0
local PostgreSQL 16 service: Running
host port 5432: still listening only for the existing local service
```

## 12. Acceptance Criteria (61/61)

| Criteria | Evidence | Result |
|---|---|---|
| 1–5 | exact Node/pnpm; handoff pre-hash; Docker daemon/Compose | PASS |
| 6–10 | exact approved dependencies; no unknown lifecycle; frozen install; clean lock sources | PASS |
| 11–16 | PostgreSQL 18.4; index/child digests; local PG untouched; isolated port; health and SQL | PASS |
| 17–22 | migration scaffold; no business schema; versioned artifact; apply/history/DB smoke | PASS |
| 23–26 | destructive guard; clean rebuild; second fresh migrate and smoke | PASS |
| 27–32 | Redis 8.2.8 and digests; health/PONG; BullMQ 6.0.10; Infrastructure-only ownership | PASS |
| 33–40 | queue create/enqueue/receive/result/completed/cleanup; clients closed; no worker residue | PASS |
| 41–46 | Domain/Application/Web/UI/Contracts isolation; raw negative FAIL; self-test PASS | PASS |
| 47–58 | lint, strict types, contracts, tokens, boundary, Web routes, Worker, DB/queue, unified verify | PASS |
| 59 | handoff post-hash `32 / 32` | PASS |
| 60 | Stage 6 not started | PASS |
| 61 | Gate 4.1 not started | PASS |

## 13. Final Status

```text
Stage 5 PASS — Stage 6 not started.
Gate 4.1 not started.
```
