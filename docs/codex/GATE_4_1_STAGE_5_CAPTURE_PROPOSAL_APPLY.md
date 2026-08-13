# XIANGXU — Gate 4.1 / Stage 5 Capture + Proposal + Apply Evidence

## Entry state

```text
Gate 4.1 Stage 4 PASS.
Gate 4.1 Stage 5 PASS.
Stage 6 not started.
Gate 4.2 not started.
```

```text
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
pnpm-lock.yaml SHA-256: 362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e
OpenAPI SHA-256: 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
0000 SHA-256: 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001 SHA-256: cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0002 SHA-256: 524ebabff73582a52a8ff32b1be35b0f78dd0d5a9918ced5051ac54981002bfc
migration count: 3
Handoff pre-check: 32 / 32
external AI SDK inventory: 0
```

The reviewed Stage 0–4 working state remains local and uncommitted. No earlier
publication authorization is inherited.

## Frozen Contract audit

Actual Stage 5 operations in the byte-frozen OpenAPI are:

| Method | Path | operationId | Request | Success |
|---|---|---|---|---|
| POST | `/api/v1/captures` | `createCapture` | `CreateCaptureCommand` | 201 `MutationResult` |
| POST | `/api/v1/captures/{id}/triage-proposals` | `generateStructuredTriageProposal` | `GenerateStructuredTriageProposalCommand` | 202 `MutationResult` |
| POST | `/api/v1/proposals/{id}/apply` | `applyProposal` | `ApplyProposalCommand` | 200 `MutationResult` |
| GET | `/api/v1/captures` | `listCaptures` | — | 200 `CaptureItem[]` |
| GET | `/api/v1/captures/{id}` | `getCapture` | — | 200 `CaptureItem` |
| GET | `/api/v1/proposals/{id}` | `getProposal` | — | 200 `Proposal` |

All three mutations require `Idempotency-Key`. No Proposal If-Match, public
revision, or ETag is frozen. The Stage 5 happy path can obtain the Proposal ref
from the generation MutationResult and prove state via PostgreSQL, so the three
read operations are not required and will not be implemented in this Stage.

Frozen transport schemas include:

- CreateCapture command metadata, Capture ID, and strict text RawPayload `{id,
  kind: text, text}`;
- GenerateStructuredTriageProposal command metadata;
- ApplyProposal command metadata and one-or-more `{targetRef, baseRevision}`;
- CaptureItem, Proposal, ProposalTarget, typed ProposalPatch and MutationResult;
- RFC 9457 `PROPOSAL_STALE` (409), `AI_UNAVAILABLE` (503), authentication,
  not-found, revision and idempotency errors.

Frozen Application inventory includes `CreateCapture`,
`GenerateStructuredTriageProposal`, `ApplyProposal`, `GetCapture`,
`ListCaptures`, and `GetProposal`. The CreateCapture Application command keeps
RawPayload identity/kind while the transport owns the text field; implementation
will pass validated raw content alongside the command without changing either
frozen contract.

## Typed Proposal hard gate

Stage 5 selects exactly one already-frozen Proposal path:

```text
proposalType: create
target:       { objectType: capture_item, id: captureId }
baseRevision: current Capture bigint revision
patch:
  kind: task.create
  captureId: same Capture ID
  task:
    title: deterministic normalized Capture text
    commitmentState: someday
    dueAt/dueOn: omitted
createdBy: system ActorRef
status: ready
```

Expected Apply result:

1. map the typed `task.create` patch to the existing frozen `CreateTask`
   Application command core;
2. create one canonical Task using existing Domain invariants;
3. CAS the target Capture revision, mark it accepted, and record the created
   Task ID in `materializedObjectIds` as the typed from-Capture apply effect;
4. append Fact ChangeRecords and pending Outbox events;
5. guard Proposal `ready → applied`;
6. complete Apply idempotency in the same transaction.

The `capture.classify` patch variant is not selected because Stage 1 has no
corresponding typed Application mutation command. No arbitrary JSON patch,
dynamic field update, new Core Object, or TimeBlock interpretation is needed.
The frozen Contract and typed patch gates therefore PASS without Contract
expansion.

## Implementation boundary

The authorized implementation remains limited to:

- additive migration 0003 with `capture.raw_payloads`,
  `capture.capture_items`, `ai.proposals`, and `ai.proposal_targets` only;
- deterministic local generator with Domain structured validation;
- Worker job intent containing IDs only and invoking Application;
- real PostgreSQL repositories/UoW and frozen mutation Routes;
- no real model provider, dispatcher, queue payload text, SSE, TanStack,
  offline storage, product UI, browser work, commit, or push.

## Migration and persistence evidence

Migration `0003_mean_argent.sql` is additive and creates exactly the approved
four tables:

- `capture.raw_payloads` with immutable text identity/content, owner, SHA-256
  content hash, and creation time;
- `capture.capture_items` with owner, unique RawPayload reference, parse/triage
  state, bigint revision, Proposal reference, and materialized object IDs;
- `ai.proposals` with typed structured patch, evidence/risk/status, immutable
  provenance, and no public Proposal revision;
- `ai.proposal_targets` with Proposal/object identity and bigint base revision.

There is no migration `0004`, no destructive DDL, and no later-Stage table.
The final database artifact state is:

```text
migration count: 4
0003 SHA-256: fefa9806107faf7b057479f93ce5176e0e3a6ddc8ddec97dad24e4a99bddc1f5
0003 snapshot SHA-256: c40e5026e510795c636bd26b036f34ac3d447e691c02a6eb46996d9fd527543c
```

Two fresh PostgreSQL 18.4 rebuild cycles each applied all four migrations and
passed 32 / 32 database integration tests. The first pre-final rebuild exposed
one test-isolation defect: an assertion counted every concurrently-created Task
instead of the current owner/capture/command scope. The assertion was narrowed
to the invariant under test; production code was unchanged. The single allowed
retry then passed both fresh cycles completely.

## Runtime and governance evidence

Capture creation stores RawPayload, Capture revision 1, ChangeRecord, pending
Outbox event, and completed idempotency atomically. Queue and Outbox payloads
contain IDs and metadata only; raw Capture text is not copied into them.

Generation uses a deterministic local generator behind an Application port. It
produces only the audited `proposalType=create` / `task.create` structure,
validates the complete runtime shape in Domain, records a system-created ready
Proposal and its base revision, and leaves Capture and canonical Facts unchanged.
Invalid generator output rolls back, and generator unavailability is mapped to
RFC 9457 `AI_UNAVAILABLE` (503).

The Worker processor accepts IDs, owner identity, and idempotency metadata only.
The production-built Worker processor was imported by the HTTP integration
harness and proved Worker -> Application -> PostgreSQL. It has no PostgreSQL or
Drizzle import and cannot bypass Application.

Apply is an explicit user mutation. It reserves idempotency before reading
state, locks the Proposal row, conceals foreign ownership, requires `ready`,
matches the frozen target list, and rechecks the current Capture revision. It
then maps the typed patch to the existing CreateTask business core and commits
Task, Capture CAS/revision 2, ChangeRecords, pending Outbox events, guarded
Proposal `ready -> applied`, and idempotency in one PostgreSQL transaction.
Exact replay returns the stored result without reapplying. Changed-key replay
conflicts, stale base revision returns `PROPOSAL_STALE` (409) with no partial
write, and concurrent Apply has exactly one winner.

## Verification evidence

The following final checks passed:

```text
pnpm lint
pnpm typecheck
pnpm boundary
pnpm boundary:test
pnpm contracts:check
pnpm contracts:drift:test
pnpm tokens:check
pnpm test
pnpm build
pnpm web:build
pnpm worker:build
pnpm worker:smoke
pnpm infra:smoke
pnpm verify
```

The final unified `pnpm verify` completed successfully in 86.2 seconds. Its
infrastructure phase passed 32 / 32 PostgreSQL tests, the real production-build
Stage 3 + 4 + 5 HTTP integration matrix, Redis 8.2.8 health, and the existing
BullMQ smoke. Domain tests passed 9 / 9, Application tests 9 / 9, Contracts tests
12 / 12, and all workspace typecheck/build/boundary checks passed.

The production HTTP matrix proves authentication failure, missing/short/
malicious authority rejection, actor isolation, Capture exact replay and
concurrent creation, deterministic ready Proposal generation through the real
Worker processor, explicit Apply/replay/conflict, stale rollback, and concurrent
single-winner Apply. No Capture/Proposal GET route was added.

## Final frozen-state and cleanup audit

```text
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
staged files: 0
Handoff post-check: 32 / 32
pnpm-lock.yaml SHA-256: 362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e
OpenAPI SHA-256: 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
0000 SHA-256: 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001 SHA-256: cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0002 SHA-256: 524ebabff73582a52a8ff32b1be35b0f78dd0d5a9918ced5051ac54981002bfc
external AI SDK manifest matches: 0
Worker database import matches: 0
Capture/Proposal GET exports: 0
Stage 6 capability matches in Stage 5 implementation: 0
Stage 5 containers: 0
Stage 5 volumes: 0
listeners on test ports 43117 / 55432 / 56379: 0 / 0 / 0
git diff --check: PASS
```

No dependency was added, the lockfile and byte-frozen OpenAPI remain unchanged,
and the read-only Handoff remains 32 / 32. No commit, staging, push, publication,
Stage 6 work, or Gate 4.2 work was performed.

## Final disposition

```text
Gate 4.1 Stage 5 PASS — Stage 6 not started.
Gate 4.2 not started.
```
