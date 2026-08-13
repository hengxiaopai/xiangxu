# XIANGXU — Gate 4.1 / Stage 3 Dev Session + Task Runtime Evidence

## Attempt 1 — Contract mismatch

```text
Gate 4.1 Stage 3 BLOCKED —
Stage 4 not started.
Gate 4.2 not started.
```

The Stage 3 entry audit stopped before implementation because the frozen Stage 1
OpenAPI contract does not contain the required authenticated identity route:

```text
GET /api/v1/me
```

The Stage 3 authorization explicitly requires this route and also requires an
immediate stop when the minimum route set differs from the Stage 1 OpenAPI. Stage
3 is not authorized to change the contract unilaterally.

## Baseline

```text
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
pnpm-lock.yaml SHA-256: d3be84f46243680dab55b54c8b720c11ba8fe204c1ab1f7b50baa9c1fd7ee071
Handoff: 32 / 32 unchanged
OpenAPI artifact SHA-256: 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
```

The existing uncommitted Stage 0–2 reviewed delta was present at entry and was
not modified by Stage 3 implementation work. It comprises the already-reviewed
Stage 0 ADR/audit, Stage 1 Contract/Domain/Application intent foundation, Stage 2
migration/PostgreSQL infrastructure foundation, their evidence, boundary policy,
generated OpenAPI artifact and workspace manifest/lock changes.

## Frozen Route Audit

Required by the Stage 3 authorization:

```text
POST   /api/dev/session
DELETE /api/dev/session
GET    /api/v1/me
POST   /api/v1/tasks
GET    /api/v1/tasks/{id}
POST   /api/v1/tasks/{id}/complete
```

Present in `artifacts/openapi/xiangxu-v1.json`:

```text
POST   /api/dev/session                    createDevSession
DELETE /api/dev/session                    deleteDevSession
POST   /api/v1/tasks                       createTask
GET    /api/v1/tasks/{id}                  getTask
POST   /api/v1/tasks/{id}/complete         completeTask
```

Absent from the artifact and generator:

```text
GET /api/v1/me
```

There is no equivalent identity operation in the complete OpenAPI path and
operation inventory. The Stage 1 Application query union likewise contains no
`GetMe` query.

## Non-entry Proof

Because the contract mismatch is a hard stop:

- no Application handler or service was added;
- no Next.js Route Handler or composition root was added;
- no dependency or lifecycle policy changed;
- no migration was generated and no `0002` exists;
- no database, Docker, Next production server or test listener was started;
- no product UI, TimeBlock, Capture, Proposal, Worker, Outbox dispatcher, SSE,
  TanStack runtime or Chromium work was started;
- no commit or push was performed.

## Human Contract Decision

The Stage 3 Recovery decision confirmed that the first stop was correct. The
earlier Stage 3 instruction had carried an obsolete Plan item into the active
acceptance criteria. The human decision is:

```text
do not expand the Stage 1 Contract;
remove GET /api/v1/me from Stage 3 acceptance;
use protected Task routes as the session and actor proof.
```

The corrected frozen route set was re-audited successfully:

```text
POST   /api/dev/session
DELETE /api/dev/session
POST   /api/v1/tasks
GET    /api/v1/tasks/{id}
POST   /api/v1/tasks/{id}/complete
```

All five routes and their operation IDs exist in the frozen Stage 1 OpenAPI.
No `/api/v1/me`, identity DTO or identity query was added.

## Attempt 2 — Workspace-edge / frozen-lock conflict

Recovery implementation stopped before runtime code was added because the
correct Stage 3 dependency direction cannot be represented by the current Web
manifest without changing the frozen lockfile.

The approved architecture requires:

```text
Route -> Contracts -> Application handler -> ports
server composition -> Application + Infrastructure adapters
```

`tools/boundary/boundary-matrix.json` permits `@xiangxu/web` to depend on
`@xiangxu/application` and `@xiangxu/contracts`, but `apps/web/package.json` and
the `apps/web` lockfile importer currently declare neither workspace edge. The
boundary checker has `requireDeclaredWorkspaceImports: true`.

Therefore the only two available paths are both prohibited:

1. declare the two workspace dependencies, which necessarily changes the
   authoritative Stage 2 `pnpm-lock.yaml` SHA-256 and violates the Recovery
   dependency/lock freeze; or
2. import through undeclared/transitive dependencies or re-export Application
   through Infrastructure, which violates manifest enforcement and the approved
   architecture.

No dependency was added and the lockfile remains:

```text
d3be84f46243680dab55b54c8b720c11ba8fe204c1ab1f7b50baa9c1fd7ee071
```

## Human Dependency Decision

The `/api/v1/me` issue is resolved. Stage 3 can now resume only after an explicit
dependency-governance decision does one of the following:

1. approve adding the existing workspace-only dependencies
   `@xiangxu/application: workspace:*` and `@xiangxu/contracts: workspace:*` to
   `apps/web/package.json`, regenerate the lockfile, and establish the resulting
   SHA-256 as the new Stage 3 baseline; or
2. provide another reviewed dependency representation that passes the existing
   declared-import and architecture checks without weakening them.

The user explicitly approved both workspace-only edges and lock regeneration.
No external package was added by Stage 3. `pnpm install --lockfile-only
--ignore-scripts` ran under Node `24.19.0` and pnpm `11.21.0`; it also reconciled
already-approved but previously unsynchronized Stage 0–2 manifest importers. The
new authoritative lock SHA-256 is:

```text
362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e
```

## Recovery implementation

Implemented Application capabilities:

```text
EstablishDevSession
ResolveActor
EndDevSession
CreateTask
GetTask
CompleteTask
```

`PgUnitOfWork` now exposes the transaction-bound Idempotency repository on the
same checked-out PostgreSQL connection as Task, ChangeRecord and Outbox. Create
and Complete reserve, mutate, audit, enqueue and store the successful response
inside one transaction. Complete validates the ETag grammar at HTTP, fingerprints
the target/body/base revision, checks completed replay before reading the current
Fact, and retains the final PostgreSQL CAS write.

Implemented frozen routes only:

```text
POST   /api/dev/session
DELETE /api/dev/session
POST   /api/v1/tasks
GET    /api/v1/tasks/{id}
POST   /api/v1/tasks/{id}/complete
```

Routes import Contracts and Application. Only
`apps/web/src/server/composition/**` imports Infrastructure. Web imports neither
`pg` nor Drizzle. The production build uses the reviewed workspace-source webpack
mapping because Turbopack does not resolve the repository's NodeNext `.js` source
specifiers to TypeScript; package module conventions were not changed.

## Session and authority proof

- Dev Session is disabled unless profile is exactly `local` or `test` and
  `XIANGXU_DEV_SESSION_ENABLED=1`.
- `production` profile remains 404 even when the enable flag is `1`.
- The raw session token is 32 secure random Node crypto bytes encoded as opaque
  base64url; PostgreSQL stores only its SHA-256 hash.
- Cookie attributes verified: dev-specific name, HttpOnly, SameSite=Lax, Path=/,
  explicit Max-Age; the value is not present in response JSON or evidence.
- Protected routes resolve Cookie -> hash -> active, unexpired, unrevoked
  DeviceSession -> server Actor.
- Strict Create DTO rejects malicious `ownerId`/`actorId`/`userId` additions.
- Task owner and ChangeRecord actor equal the authenticated session user.
- Audit `sourceContext` is server-overridden to the authoritative route and
  `dev-local`; client source fields cannot forge it.
- Session B receives concealed 404 for Session A's Task.
- Expired and revoked sessions receive RFC 9457 401.
- DELETE revokes the persisted session and clears the cookie.

## Real production-build HTTP proof

The guarded harness uses PostgreSQL `18.4`, migrations `0000 -> 0001`, `next
build --webpack`, and real `next start` on `127.0.0.1:43117`. It proved:

```text
Create Task -> revision "1", ETag "rev-1"
GET Task    -> body/ETag revision consistency
Complete    -> revision "2", ETag "rev-2"
GET Task    -> completed revision "2"
```

Negative and concurrency matrix:

```text
missing / expired / revoked session -> 401
foreign actor -> concealed 404
invalid strict DTO -> 400 and no DB mutation
missing / invalid Idempotency-Key -> 400
Create exact replay -> same 201/body/ETag, one mutation
Create concurrent duplicate -> one business mutation
Create same key / changed payload -> 409 IDEMPOTENCY_CONFLICT
missing If-Match -> 428 PRECONDITION_REQUIRED
W/"rev-1", *, rev-1, "rev-01" -> 400 VALIDATION_ERROR
stale If-Match -> 412 PRECONDITION_FAILED
Complete exact replay with original "rev-1" -> original rev2 success, no rev3
Complete same key with base "rev-2" -> 409 IDEMPOTENCY_CONFLICT
new completion of completed Task -> frozen conflict, no revision increment
unknown Task -> 404
```

Database inspection after the HTTP cases proved exact Task/ChangeRecord/Outbox/
Idempotency counts, base/new revisions `1/1` and `1/2`, Outbox `pending`, matching
command/correlation chains, server Actor ownership, server source, and no orphan
records after validation/409/412 failures. A deterministic Application test also
proves a CAS lost after successful validation maps to `REVISION_CONFLICT` without
LWW or retry.

## Frozen artifact and regression proof

```text
OpenAPI SHA-256: 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
0000 SHA-256:    5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001 SHA-256:    cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
migration count: 2
0002: absent
Handoff: 32 / 32 unchanged
```

`pnpm db:generate` reported `No schema changes, nothing to migrate`. Stage 2
two-cycle clean rebuild passed PostgreSQL 18.4, migration count 2 and 13/13 real
integration tests in both cycles.

Final unified verification under Node `24.19.0` / pnpm `11.21.0`:

```text
pnpm verify PASS
CI policy negative fixtures: 33
typecheck: 8 / 8 workspaces
boundary: 75 source files, 7 manifest edges
boundary self-test: 63 expected violations
Domain: 9 / 9
Application: 5 / 5
Contracts: 12 / 12
Stage 2 PostgreSQL: 13 / 13
Stage 3 production HTTP: PASS
Web production build: PASS
Worker regression: PASS
Redis 8.2.8 / BullMQ fake job: PASS
```

The final local verification used isolated Redis port `56379` because port 6379
belongs to the unrelated `stage-letter` project; that project was not touched.
Default and CI behavior remains 6379. The secret/authority scan found zero actual
violations; its only textual match was the Stage 2 test title asserting hash-only
session persistence.

## Cleanup and non-entry

```text
Next production server: 0
XIANGXU containers: 0
XIANGXU volumes: 0
55432 listener: 0
43117 listener: 0
56379 listener: 0
local PostgreSQL 5432: untouched
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
commit: none
push: none
```

No `/api/v1/me`, product UI, TimeBlock, Calendar, Capture, Inbox, Proposal,
business Worker/dispatcher, SSE runtime, TanStack runtime, IndexedDB, formal auth
provider or Chromium work was added.

## Final decision

```text
Gate 4.1 Stage 3 PASS —
Stage 4 not started.
Gate 4.2 not started.
```
