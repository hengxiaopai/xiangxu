# Gate 4.1 Stage 1 — Contract & Pure Domain Evidence

Date: 2026-08-12
Status: **PASS — Stage 2 not started; Gate 4.2 not started**

## Scope and baseline

Stage 1 froze Domain values/invariants, Application command/query intent, transport DTOs, concurrency, RFC 9457, typed Proposal patches, durable event/SSE contracts, and OpenAPI. It did not create a business migration/table, repository/UoW, handler, dispatcher, BullMQ business job, SSE runtime, TanStack/IndexedDB runtime, dev-session runtime, persistence, product UI, browser download, commit, or push.

```text
Node v24.19.0
pnpm 11.21.0
pnpm-lock.yaml SHA-256 820eeafe0719ee3bfc59b3c274a4057a0cf5093d604192107fb1b86985808a19
Handoff pre/post 32/32 unchanged
```

The worktree intentionally included the accepted, uncommitted Stage 0 delta. Its 23-file identity snapshot was:

```text
3d1fb0... AGENTS.md
779cc7... apps/web/package.json
22da0e... docs/codex/ADR-G4.1-001-REVISION-HTTP-CONCURRENCY.md
06ee0b... docs/codex/GATE_4_1_STAGE_0_DEPENDENCY_CONTRACT_DECISION.md
dc8004... docs/codex/GATE_4_1_STAGE_0_NATIVE_PLATFORM_AUDIT.json
16602e... package.json
1c541e... packages/testing/fixtures/boundary/negative/apps/web/package.json
672fae... packages/testing/fixtures/boundary/negative/apps/web/src/client-bridge.ts
3794ef... packages/testing/fixtures/boundary/negative/apps/web/src/client-entry.ts
7b3b72... packages/testing/fixtures/boundary/negative/apps/web/src/server/composition/allowed.ts
6c0ee0... packages/testing/fixtures/boundary/negative/apps/web/src/server/composition/deep.ts
7b3b72... packages/testing/fixtures/boundary/negative/apps/web/src/server/other.ts
450f0a... packages/testing/fixtures/boundary/positive/apps/web/next.config.mjs
8e609b... packages/testing/fixtures/boundary/positive/apps/web/next-env.d.ts
cbf9a3... packages/testing/fixtures/boundary/positive/apps/web/package.json
7b3b72... packages/testing/fixtures/boundary/positive/apps/web/src/server/composition/index.ts
820eea... pnpm-lock.yaml
908f80... pnpm-workspace.yaml
c0259e... README.md
c266eb... tools/boundary/boundary-matrix.json
b91a5f... tools/boundary/boundary-matrix.schema.json
3762c1... tools/boundary/check-boundaries.mjs
b0ba5d... tools/boundary/test-boundaries.mjs
```

## Targeted SSOT read

- Domain Object Model: Actor, UUIDv7 identity, Task, TimeBlock, Proposal, CaptureItem, PlanSnapshot, ExecutionRecord, ReviewSnapshot, ChangeRecord, concurrency/invariants/enums.
- AI Architecture: Proposal First, typed output/patch allowlist, R0–R4, R2 explicit Apply, refresh/stale/policy/Domain validation/Application Command.
- SDD/API: CommandEnvelope, DTO primitives, RFC 9457, ETag/If-Match, Idempotency-Key, SSE, OfflineCommand, `affectedRefs + projectionHints`, HTTP inventory.
- ADR-G4.1-001: branded bigint internally, decimal-string transport, strong `"rev-N"`, 428/400/412/CAS mapping.
- Stage 0 Decision: dev session, raw payload, TimeBlock actor policy, Proposal CAS, durable outbox/SSE, composition boundary.

Scene Pack, Knowledge/Search, Connectors, providers, full Settings, and unrelated UI semantics were not pulled into Stage 1.

## Domain inventory

- `UUIDv7`: canonical lowercase RFC 9562 v7 and valid variant; Domain validates but never generates and never imports `uuid`.
- `Revision`: branded `bigint`, positive PostgreSQL bigint range; parse/increment/equality/decimal formatting. `9007199254740993` round-trips without `Number` or `parseInt`.
- `ActorRef`: `user | system | ai | connector`; authority comes from server context, never trusted command-body owner fields.
- `Task`: the only Gate 4.1 Core Object; minimal identity/title/owner/status/commitment/due/revision/audit/completion semantics.
- `TimeBlock`: identity/owner/task/start/end/timezone/locked/revision. End > start; IANA timezone; locked AI/system move rejected while explicit user adjustment is not rejected solely by lock. Overlap is not a universal invariant.
- `CaptureItem`/`RawPayloadRef`: Gate 4.1 raw kind is only `text`; interpretation never replaces raw identity.
- `Proposal`: exact frozen fields, no public revision/ETag. Patch is a discriminated allowlist using existing `classify` and `create`; no generic JSON patch.
- `ChangeRecord`: target, before/after revisions, actor, command, changed families, source/correlation/time/proposal/undo.
- Durable event: topic, affected refs, projection hints, optional revision, command/correlation/time; no sensitive raw payload field.
- Bounded `PlanSnapshot`, `PlanSnapshotItem`, immutable `ExecutionRecord`, and `ReviewSnapshot` semantics.

Tests directly prove `Task due != TimeBlock schedule != ExecutionRecord actual`; moving schedule does not mutate due and actual does not rewrite schedule or fabricate duration.

## Application inventory

Commands: `CreateTask`, `CompleteTask`, `CreateTimeBlock`, `MoveTimeBlock`, `CreateCapture`, `GenerateStructuredTriageProposal`, `ApplyProposal`, `CommitDailyPlan`, `CreateReviewSnapshot`.

Queries: `GetToday`, `GetTask`, `ListTasks`, `GetCalendarRange`, `ListCaptures`, `GetCapture`, `GetProposal`, `GetReview`, `ReplaySseEvents`.

Every command intent has command ID, server-resolved actor, idempotency/source context, optional base Revision, and typed payload. Pure decisions prove no silent LWW and idempotency first execution/exact stored replay/`IDEMPOTENCY_CONFLICT`. Canonical fingerprints are based on validated canonical request structure, not raw JSON key order. No handler, transaction, repository, UoW, SQL, DB query, or adapter exists.

## Contracts, concurrency, and problems

Domain remains pure TypeScript; Zod is transport-only. Revision JSON and Proposal base revisions are canonical positive decimal strings.

`formatRevisionEtag`/`parseRevisionEtag` are the sole ETag owner. Strong `"rev-N"` is accepted; weak/wildcard/unquoted/list/zero/leading-zero/signed/fraction/exponent/out-of-range inputs fail. Missing If-Match maps to `428 PRECONDITION_REQUIRED`, malformed to `400 VALIDATION_ERROR`, current mismatch to `412 PRECONDITION_FAILED`; later CAS race maps to `REVISION_CONFLICT`, never silent LWW.

One RFC 9457 `application/problem+json` schema validates code/status pairs. It retains frozen `AUTH_REQUIRED` rather than inventing `UNAUTHORIZED`, and includes `VALIDATION_ERROR`, `NOT_FOUND`, preconditions, revision/idempotency conflict, TimeBlock lock/conflict, Proposal stale, AI/dependency unavailable, internal error, and degraded.

Product paths are under `/api/v1`. `POST/DELETE /api/dev/session` remain separate, development-only, production fail-closed, opaque HttpOnly-cookie semantics, without a browser actor ID. Offline transport is explicitly `capture.create`, not `payload: unknown`.

## Events, SSE, and OpenAPI

`affectedRefsAndProjectionHintsSchema` is defined once and reused by HTTP mutation results, durable events, and SSE. There is no invalidate-everything flag.

The single versioned SSE union is `system.contract-metadata | object.changed | proposal.ready | job.progress | system.resync-required`. Revision-bearing events use decimal strings. Resync-required models a retention gap. No SSE runtime or Worker shortcut exists.

The existing OpenAPI `3.1.2` generator owns the authorized Today, Task, Calendar/TimeBlock, Capture, Proposal, Plan, Review, SSE replay, and isolated dev-session schemas/paths. Two consecutive generations were byte-identical:

```text
OpenAPI SHA-256 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
```

## Tests, dependency guard, and verification

Real canonical-graph Vitest suites: Domain 9, Application 3, Contracts 12; total 24 passed. Positive/raw-negative cases cover UUIDv7, revision/extreme value, ETag/If-Match, Idempotency-Key, Task, TimeBlock interval/timezone/locked actor, Capture/raw ref, Proposal exact fields/targets/typed patch/no revision/stale, no silent LWW, Problem Details, OfflineCommand, and SSE.

Boundary enforcement permits the already-approved root `vitest@4.1.10` only in `src/**/*.test.ts`; a positive fixture passes and a non-test production import fails. Production manifests remain dependency-clean. Dependency delta is zero and lock content/hash are unchanged.

```text
pnpm lint             PASS
pnpm typecheck        PASS — 8/8 workspaces
pnpm boundary         PASS — 8 workspaces, 56 source files, 3 manifest edges
pnpm boundary:test    PASS — positive exit 0, negative exit 1, 60 expected violations
pnpm test             PASS — 24 new Vitest cases plus existing tests
pnpm contracts:check  PASS
pnpm verify           PASS
Handoff               PASS — 32/32 unchanged
```

Stage 1 delta is confined to repository status/evidence, `artifacts/openapi`, `packages/domain`, `packages/application`, `packages/contracts`, two Domain boundary fixtures, and `tools/boundary`. Files in the recorded Stage 0 snapshot remain accepted Stage 0 changes.

## Closure

All 48 Stage 1 acceptance conditions are closed.

```text
Gate 4.1 Stage 1 PASS —
Stage 2 not started.
Gate 4.2 not started.
```
