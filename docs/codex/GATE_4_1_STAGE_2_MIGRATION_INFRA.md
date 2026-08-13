# Gate 4.1 Stage 2 — Reviewed Migration & Infrastructure Evidence

Date: 2026-08-12
Status: **PASS — Stage 3 not started; Gate 4.2 not started**

## Baseline and targeted SSOT

Stage 1 PASS was the accepted entry baseline. Exact toolchain remained Node `24.19.0` and pnpm `11.21.0`; entry lock SHA-256 was `820eeafe0719ee3bfc59b3c274a4057a0cf5093d604192107fb1b86985808a19`. Handoff integrity was 32/32 at Stage 1 closure and 32/32 at Stage 2 final audit.

Actually read:

- Stage 1 Contract/Domain evidence.
- ADR-G4.1-001 revision/HTTP concurrency.
- Stage 0 dependency/contract decision.
- Gate 3.8 SDD tables for PostgreSQL primitives, schema/table families, `core.objects`, typed details, indexes, `UnitOfWork`, `RevisionedRepository`, ChangeRecord, Outbox and idempotency.
- Domain Object Model tables for Task, ActorRef, revision, ChangeRecord and invariants.

Proposal, TimeBlock policy, SSE, Offline and UI were not redesigned.

## Migration scope and deferred tables

The immutable Stage 5 migration remains:

```text
0000_motionless_bloodaxe.sql
SHA-256 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
```

Stage 2 adds exactly:

```text
0001_noisy_ravenous.sql
SHA-256 cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0001 snapshot SHA-256 b1bbb7ab46728a3a806f0384b7af85362c5f46dc36e53ae7452dba4e7cbf6d1e
```

Inventory:

```text
identity.users
identity.device_sessions
core.objects
core.task_details
audit.change_records
infra.outbox_events
infra.idempotency_keys
public.infra_bootstrap_sentinel (unchanged)
```

Explicitly absent: TimeBlock, raw payload/Capture, Proposal/targets, PlanSnapshot/items, ExecutionRecord and ReviewSnapshot tables.

The SQL audit found only additive `CREATE SCHEMA`, `CREATE TABLE`, FK/check constraints, indexes, the Outbox identity sequence, and an append-only audit trigger. It contains no destructive DROP/TRUNCATE/data DELETE/CASCADE drop and does not alter the sentinel. Drizzle `push` was not used.

Second `db:generate` returned `No schema changes, nothing to migrate`; all five migration artifacts were byte-identical and no 0002 appeared.

## Constraint and index inventory

Physical invariants include:

- UUIDv7 defaults via PostgreSQL 18 `uuidv7()`.
- Unique deterministic dev subject and unique session token hash.
- Session FK and expiry-after-creation constraint.
- `core.objects.revision BIGINT DEFAULT 1 NOT NULL CHECK > 0` as the single Task revision owner.
- Task-only object type/status checks, actor/source checks, positive schema version.
- 1:1 `core.task_details` FK, commitment enum, due date/instant mutual exclusion.
- Idempotency primary key over actor type + actor ID + command type + Idempotency-Key.
- ChangeRecord positive bigint revisions and database trigger rejecting UPDATE/DELETE.
- Outbox positive optional revision, nonnegative attempts, durable monotonic BIGINT identity sequence.

Reviewed indexes cover dev subject, token hash/session lookup, Task owner lookup, ChangeRecord target/correlation, Outbox pending ordering/correlation, and idempotency created time. No search/vector/analytics index was added.

## Infrastructure implementation

Application owns minimal ports for Task `insert/getById/updateCas`, UnitOfWork, ChangeRecord append/read, Outbox append/read, device sessions and idempotency. No business handler exists.

Infrastructure provides explicit pg-row-to-Domain mappers, `PgTaskRepository`, `PgUnitOfWork`, `PgChangeRecordRepository`, `PgOutboxRepository`, `PgIdentityRepository`, `PgDeviceSessionRepository` and `PgIdempotencyRepository`. DB rows and QueryResult objects are never returned across the boundary; Domain and Contracts remain DB-free, and Zod is not used for DB mapping.

Task CAS is a data-modifying SQL CTE using `WHERE id=$id AND revision=$baseRevision`, `revision=revision+1`, and `RETURNING`. There is no SELECT-then-unconditional-UPDATE and no retry to last-write-wins.

`PgUnitOfWork` owns one checked-out connection, central BEGIN/COMMIT/ROLLBACK and transaction-bound Task/Change/Outbox repositories. Infrastructure does not decide CompleteTask, Proposal or TimeBlock business policy.

## PostgreSQL integration proofs

One sequential real Vitest suite contains 13 cases and runs inside protected infrastructure smoke/rebuild contexts.

- PostgreSQL 18.4 `uuidv7()` output passes the Stage 1 Domain validator.
- Task insert/read returns Domain values, not snake_case DB rows.
- Revision `9007199254740993` writes/reads with exact bigint equality.
- Revision 1 CAS succeeds to 2; stale base 1 affects zero and leaves Fact unchanged.
- Two concurrent writers at base 1 produce exactly one update and one conflict.
- Successful mutation commits Task revision + ChangeRecord + Outbox together.
- ChangeRecord/Outbox share command ID, correlation ID, target ID and revision.
- Outbox payload is limited to affected refs and projection hints; no raw content or secret field exists.
- Failure after Fact, after ChangeRecord, and after Outbox/before commit each rolls back Fact and leaves zero audit/outbox orphans.
- Direct ChangeRecord UPDATE is rejected by the append-only trigger; repository exposes no update/delete API.
- Concurrent identical idempotency reservations produce one first owner and one in-progress observer; one Task is inserted.
- Completed replay returns the stored transport-neutral result; changed fingerprint returns conflict without another mutation.
- Device session persists only a SHA-256 hash, never the raw fixture token; active lookup, expiry and revocation semantics pass.

## Fresh replay and cleanup

Guarded `db:rebuild:smoke` ran two independent cycles:

```text
cycle 1: empty project volume → 0000 → 0001 → 13/13 integration → schema smoke → teardown PASS
cycle 2: empty project volume → 0000 → 0001 → 13/13 integration → schema smoke → teardown PASS
```

Each reported migrationCount=2, PostgreSQL 18.4 and sentinelRowsAfterCleanup=0. Final XIANGXU project containers=0, project volumes=0 and listener 55432=0. The pre-existing local PostgreSQL listener on 5432 remained PID 8352 (`postgres`) and was never connected to, stopped, altered or dropped.

## Dependency and lifecycle audit

Direct TypeScript import of `pg` required declarations because `pg@8.23.0` ships no TypeScript declaration file. The sole conditionally approved external delta is exact Infrastructure devDependency `@types/pg@8.20.0`: MIT, DefinitelyTyped source, integrity-pinned, empty scripts and no lifecycle. Workspace edges to Application/Domain were declared and boundary-checked. No other dependency was added.

Final lock SHA-256:

```text
d3be84f46243680dab55b54c8b720c11ba8fe204c1ab1f7b50baa9c1fd7ee071
```

Existing lifecycle policy remains unchanged: exact esbuild 0.18.20/0.25.12/0.28.2 allowed; msgpackr-extract 3.0.4 and fsevents 2.3.2 denied; Rolldown/Lightning CSS remain prebuilt without build lifecycle.

## Verification and non-entry

```text
Migration generation determinism PASS
Fresh rebuild cycle 1/2 PASS
PostgreSQL integration 13/13 PASS per cycle
Stage 1 Vitest 24/24 PASS
OpenAPI/contracts PASS
Boundary PASS — 8 workspaces, 65 source files, 5 manifest edges
Boundary self-test PASS — positive 0, negative 1, 61 expected violations
Strict typecheck PASS
Lint PASS
Web/Worker shell PASS
Redis 8.2.8/BullMQ fake smoke PASS
pnpm verify PASS
Handoff post 32/32
```

No Dev Login/API route/CreateTask or CompleteTask handler/product UI/TimeBlock/Capture/Proposal/business Worker/SSE/TanStack/IndexedDB/Review/Chromium work was started. No commit or push was performed.

```text
Gate 4.1 Stage 2 PASS —
Stage 3 not started.
Gate 4.2 not started.
```
