# XIANGXU — Gate 4.1 / Stage 4 TimeBlock Evidence

## Final decision

```text
Gate 4.1 Stage 4 PASS — Create / Move-only Recovery scope complete.
Stage 5 not started.
Gate 4.2 not started.
```

Stage 4 was completed under the explicit Recovery decision that removed direct
TimeBlock Read from the objective. No `GET /api/v1/time-blocks/{id}` Route,
Application query, DTO, or replacement contract was introduced.

## Attempt 1 — preserved BLOCKED history

The first Frozen Contract Audit correctly stopped before implementation:

```text
Gate 4.1 Stage 4 BLOCKED —
frozen Stage 1 TimeBlock contract insufficient for the original
Create / Read / Move wording.
```

The frozen inventory contained only:

```text
POST  /api/v1/time-blocks       createTimeBlock  -> 201 MutationResult
PATCH /api/v1/time-blocks/{id}  moveTimeBlock    -> 200 MutationResult
```

There was no TimeBlock GET operation or Application `GetTimeBlock` query. The
attempt added no migration, persistence, handler, Route, dependency, or runtime
work. This BLOCKED history remains part of the audit trail.

## Recovery contract

The human Recovery decision explicitly froze the Stage 4 surface to:

- `POST /api/v1/time-blocks`;
- `PATCH /api/v1/time-blocks/{id}`;
- internal actor-scoped repository reads only;
- state proof through MutationResult/ETag, PostgreSQL inspection, and the
  existing Task GET for due/revision invariance.

The deterministic OpenAPI artifact remained byte-stable. No new direct read
surface was invented.

## Migration 0002

`0002_spotty_mindworm.sql` adds only `planning.time_blocks` with:

- UUIDv7 identity, owner and Task foreign keys;
- `timestamptz` start/end, IANA timezone, locked flag and bigint revision;
- `end_at > start_at` and positive revision checks;
- owner/interval and Task indexes.

It adds no status column, global exclusion constraint, destructive SQL, or
second business table. A second `pnpm db:generate` returned `No schema changes`;
there is no 0003.

```text
0000 SHA-256: 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001 SHA-256: cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0002 SHA-256: 524ebabff73582a52a8ff32b1be35b0f78dd0d5a9918ced5051ac54981002bfc
0002 snapshot SHA-256: a7ec25d2aa691e03fe76c14c711bc8166e748855622f50fc035e6a0bbb00a9bd
migration count: 3
```

## Transaction and authority proof

Create and Move use one checked-out PostgreSQL connection and transaction. The
order is idempotency reservation, transaction-scoped owner advisory lock,
authorization/current-state checks, half-open overlap check, mutation, append-
only ChangeRecord, ordered Outbox, idempotency completion, commit.

- overlap is `existing.start < candidate.end AND existing.end > candidate.start`;
- adjacent blocks are accepted;
- concurrent overlapping creates serialize per owner and exactly one commits;
- Move performs SQL CAS with `WHERE id = ? AND revision = ?`;
- exact replay is resolved before current-state reads, so an old-revision replay
  returns the original revision without a second mutation;
- foreign Task Create and foreign TimeBlock Move return not found and leave no
  reservation, Fact, ChangeRecord, or Outbox orphan;
- authenticated user Move of `locked=true` is allowed;
- system Move of `locked=true` fails with `TIMEBLOCK_LOCKED` before overlap,
  CAS, audit, or Outbox writes;
- Create/Move leave the referenced Task due fields and revision unchanged;
- no execution-record table or write was added.

## Verification

```text
Node: 24.19.0
pnpm: 11.21.0

pnpm db:rebuild:smoke
  cycle 1: PostgreSQL 18.4, migrations 3, tests 21/21 PASS
  cycle 2: PostgreSQL 18.4, migrations 3, tests 21/21 PASS
  Stage 2 regression remains 13 tests; Stage 4 adds 8 tests

pnpm web:build
  next build --webpack PASS
  TimeBlock route inventory contains POST collection and PATCH member only

XIANGXU_STAGE5_REDIS_TEST_PORT=56379 pnpm infra:smoke
  PostgreSQL 18.4 PASS
  Redis 8.2.8 / BullMQ fake job PASS
  real next start HTTP Stage 3 + Stage 4 matrix PASS

XIANGXU_STAGE5_REDIS_TEST_PORT=56379 pnpm verify
  CI policy, lint, strict typecheck, boundaries and negative fixtures,
  byte-stable contracts, token check, tests, builds, infrastructure and HTTP
  integration PASS
  boundary: 8 workspaces, 79 source files, 7 manifest edges
```

The first combined smoke attempt detected that host port 6379 belonged to an
existing user container. It stopped before tests and cleaned its own temporary
container, network, volume, and context. The single retry used the already
reviewed isolated fallback port 56379; the existing 6379 resource was neither
stopped nor modified.

## Frozen baseline and non-entry proof

```text
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
pnpm-lock.yaml SHA-256: 362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e
OpenAPI SHA-256: 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
Handoff: 32 / 32 unchanged
```

- dependency delta: zero; lifecycle policy unchanged;
- no TimeBlock GET, Calendar UI, Capture, Proposal, Worker, SSE, TanStack,
  IndexedDB, Playwright, Chromium, Stage 5, or Gate 4.2 work;
- no commit or push was performed;
- temporary Next processes, project Docker containers, network, volumes,
  PostgreSQL 55432 and Redis 56379 were cleaned; unrelated local services were
  left untouched.
