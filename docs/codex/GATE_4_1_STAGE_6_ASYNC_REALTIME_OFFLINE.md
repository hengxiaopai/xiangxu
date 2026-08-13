# XIANGXU — Gate 4.1 / Stage 6 Async, Realtime, and Offline Audit

## Final disposition

```text
Gate 4.1 Stage 6 PASS —
Stage 7 not started.
Gate 4.2 not started.
```

Stage 6 passed after the explicit Human Recovery decision described below. The
initial stop is retained as audit history rather than rewritten.

## Attempt 1 disposition — preserved

```text
Gate 4.1 Stage 6 BLOCKED —
frozen dispatch-routing contract insufficient.

Stage 7 not started.
Gate 4.2 not started.
```

The formal Stage 6 authorization requires two pre-implementation hard gates.
The frozen realtime and Offline contracts pass. The existing Outbox is
structurally sufficient for durable claims and actor-scoped SSE without a new
migration. The required BullMQ business-routing gate does not pass, so no Stage
6 runtime implementation was started.

## Authoritative baseline

```text
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
pnpm-lock.yaml SHA-256: 362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e
OpenAPI SHA-256: 87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f
0000 SHA-256: 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001 SHA-256: cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0002 SHA-256: 524ebabff73582a52a8ff32b1be35b0f78dd0d5a9918ced5051ac54981002bfc
0003 SHA-256: fefa9806107faf7b057479f93ce5176e0e3a6ddc8ddec97dad24e4a99bddc1f5
migration count: 4
Handoff pre-check: 32 / 32
staged files: 0
```

Stage 0–5 remain reviewed local deltas. No earlier publication authorization is
inherited.

## Hard gate 1 — Frozen Contract audit: PASS

The byte-frozen OpenAPI contains `GET /api/v1/stream` with operation ID
`replaySseEvents`, optional `Last-Event-ID`, optional `channels`, and a
`text/event-stream` response using the single `SseEventEnvelope` contract.

The versioned SSE union is exactly:

```text
system.contract-metadata
object.changed
proposal.ready
job.progress
system.resync-required
```

Envelope IDs are strings. Revision-bearing data uses canonical positive decimal
PostgreSQL bigint strings, so no JavaScript Number conversion is required.
`system.resync-required` is frozen with empty affected refs, projection hints,
`reason=retention_gap`, and optional latest event ID.

The frozen durable event topics are narrower:

```text
object.changed
proposal.ready
```

Durable events carry event ID, topic, affected refs, projection hints, optional
decimal revision, command/correlation identity, and occurrence time. They carry
no owner authority or raw Capture text.

The frozen `OfflineCommand` is `capture.create` only and contains:

```text
localId
commandType = capture.create
payload = validated CreateCapture command
idempotencyKey
requestFingerprint
capturedAt
retryCount
state = pending | syncing | conflict | done | failed
```

The frozen read operations are Today, Task list/get, Calendar range, Capture
list/get, Proposal get, Review get, and SSE replay. The Application query intents
match those operations: `GetToday`, `GetTask`, `ListTasks`, `GetCalendarRange`,
`ListCaptures`, `GetCapture`, `GetProposal`, `GetReview`, and
`ReplaySseEvents`. The current Web runtime implements only the already-frozen
Task GET. Stage 6 must not pretend the other frozen declarations already have
runtime query adapters.

## Hard gate 2A — Existing Outbox and SSE actor scope: PASS

`infra.outbox_events` already has:

```text
BIGINT monotonic sequence
UUID event ID
topic and target ref
optional revision
affectedRefs + projectionHints payload
pending | claimed | published | failed
attempts and available_at
claimed_at and claimed_by
published_at and last_error
command_id and correlation_id
created_at
```

This is sufficient for `FOR UPDATE SKIP LOCKED`, bounded claim leases, retry,
deterministic sequence-based job identity, queue-acceptance publication state,
and durable ordered replay without migration 0004.

Actor ownership can be derived from canonical persisted Facts rather than from
client or payload authority:

| Durable target | Canonical ownership proof |
| --- | --- |
| `task` | `core.objects.owner_id` |
| `time_block` | `planning.time_blocks.owner_id` |
| `capture_item` | `capture.capture_items.owner_id` |
| `proposal` | `ai.proposal_targets` capture target joined to `capture.capture_items.owner_id` |

`proposal.ready` persists Proposal and Capture refs, but SSE authorization must
use the Proposal-target/Capture join, not trust the payload's second ref or the
client. No owner column, new table, modified migration, or 0004 is required for
the currently emitted Stage 3–5 events.

## Hard gate 2B — Durable business dispatch routing: FAIL

There is no frozen durable event that unambiguously means “generate a structured
triage Proposal for this Capture.”

Actual Stage 3–5 emission is:

| Source | Durable topic | Target | Meaning |
| --- | --- | --- | --- |
| Task create/complete | `object.changed` | Task | projection invalidation |
| TimeBlock create/move | `object.changed` | TimeBlock | projection invalidation |
| Capture create | `object.changed` | Capture | projection invalidation |
| Proposal Apply Capture CAS | `object.changed` | Capture | projection invalidation |
| Proposal generation completed | `proposal.ready` | Proposal + Capture | Proposal already exists |

The frozen `POST /api/v1/captures/{id}/triage-proposals` currently invokes the
Stage 5 generator through Application and only emits `proposal.ready` after the
Proposal is durably created. It does not persist a pre-generation dispatch
intent. Routing `proposal.ready` to generation would be causally reversed.

Routing every Capture `object.changed` event is incorrect because Apply also
emits that event. Routing only `capture_item + revision=1`, inspecting
idempotency/change records, or checking current triage state would infer a new
async lifecycle from incidental persistence details. That predicate is not a
frozen event/topic contract and would silently turn CreateCapture into automatic
Proposal generation. The authorization explicitly forbids guessed routing.

The other prohibited alternatives are also not valid:

- the HTTP route cannot call BullMQ directly;
- `proposal.ready` cannot be redefined as a pre-Proposal trigger;
- `object.changed` cannot be repurposed from invalidation into an ambiguous
  command;
- adding a trigger topic would exceed the current Outbox topic CHECK and require
  an approved Contract/schema decision, potentially migration 0004;
- raw Capture text cannot be put in the job to compensate for missing semantics.

Therefore the required chain
`committed Outbox -> BullMQ -> Stage 5 Worker -> Application -> Proposal` cannot
be implemented faithfully from the frozen taxonomy.

## Required human decision

Before Stage 6 can resume, an explicit Contract/lifecycle decision must identify
an unambiguous, persisted pre-generation trigger and its exact producer,
consumer, idempotency identity, and Outbox representation. The decision must
also state whether any topic CHECK/schema change and migration are authorized.

No choice is made here because selecting one would expand product lifecycle or
persistence semantics beyond the frozen Contract.

## Recovery decision

The human Recovery decision confirmed the initial BLOCKED result and explicitly
authorized the missing lifecycle boundary:

```text
capture.triage.requested
```

It is an internal durable dispatch intent produced by the first successful
CreateCapture transaction, routed only to the BullMQ logical job
`capture.triage.generate`, and never exposed through SSE or OpenAPI. The
decision also authorizes exactly one constraint-only migration `0004` to extend
the Outbox topic CHECK allowlist. The original Stage 6 acceptance remains in
force. Recovery implementation is now in progress; this section preserves the
Attempt 1 stop history above.

## Attempt 1 non-entry and immutability record — preserved

Because the routing hard gate failed before implementation:

```text
Stage 6 production code changes: 0
dependency delta: 0
migration delta: 0
migration count: 4
new 0004: no
lockfile changed by Stage 6: no
OpenAPI changed by Stage 6: no
dispatcher started: no
BullMQ business Worker binding started: no
SSE runtime started: no
TanStack runtime started: no
IndexedDB runtime started: no
product UI started: no
Chromium downloaded: no
commit: no
push: no
Stage 7 started: no
Gate 4.2 started: no
```

Final read-only audit after recording the stop decision:

```text
Handoff post-check: 32 / 32
HEAD: a3183a026fea893b66c7b72dd65ce0f15d7fa572
staged files: 0
XIANGXU Stage containers: 0
XIANGXU Stage volumes: 0
listeners on 43117 / 55432 / 56379: 0 / 0 / 0
git diff --check: PASS
```

The working tree intentionally still contains the reviewed, uncommitted Gate
4.1 Stage 0–5 delta plus this audit/status documentation. No unrelated local
change was modified or removed.

## Recovery implementation

ADR `ADR-G4.1-002-CAPTURE-TRIAGE-DISPATCH.md` records the approved distinction:

```text
object.changed            -> SSE invalidation only
proposal.ready             -> SSE availability only
capture.triage.requested   -> BullMQ business dispatch only
```

The first successful CreateCapture transaction now commits RawPayload, Capture
revision 1, ChangeRecord, `object.changed`, `capture.triage.requested`, and
completed idempotency atomically. The two Outbox rows have distinct purposes.
Exact replay creates neither again. Failure injection at the trigger append and
after both Outbox appends/before idempotency completion proves complete rollback
with no Capture, RawPayload, audit, event, or key orphan.

Migration `0004_normal_sabra.sql` has exactly two lines. It drops the existing
`outbox_events_topic` CHECK and adds the same constraint with the one approved
topic. It has no table/column/index/data change. A second `pnpm db:generate`
returned `No schema changes, nothing to migrate`; migration count is 5 and no
0005 exists.

```text
0004 SHA-256: e89081fbcdc578649d3c7a0e688d49e5a93f40ce9a58669c319902cd1267a6f3
0004 snapshot SHA-256: c4560593001a78db5591fb989aceb315aea9de81feb81d47eb599d6ef387d0e0
```

## Dispatcher, BullMQ, and Worker evidence

The PostgreSQL selector explicitly requires
`topic='capture.triage.requested'`; ordinary `object.changed` and
`proposal.ready` rows never become jobs. Claim uses `FOR UPDATE SKIP LOCKED`,
increments attempts, records claimant/time, accepts retryable failed rows, and
reclaims only expired claims. Two concurrent dispatchers obtain one active
owner; fresh claims are not stolen and stale claims are recoverable.

Queue acceptance is the only meaning of Outbox `published`. Redis failure marks
the trigger retryable without touching committed Capture/RawPayload. The
deterministic BullMQ job ID and Application command/idempotency key derive from
the immutable trigger event ID. BullMQ duplicate suppression is only a transport
guard; Application idempotency is the business correctness guard.

Job payload contains only Outbox ID/decimal sequence, Capture ref, command ID,
and correlation ID. It contains no raw text, owner authority, Proposal patch,
session material, cookie, secret, or Fact DTO. The compiled Stage 5
`ProposalGenerationProcessor` is bound to the real BullMQ Worker and then to
Application. Application reloads the canonical Capture, derives its owner,
constructs the system Actor, reads RawPayload inside the Application path,
validates the deterministic Proposal, and commits Proposal/target/audit/
`proposal.ready`. Worker source has no PostgreSQL, Drizzle, or direct repository
business mutation.

Real fixtures prove normal dispatch, concurrent claim, Redis down and recovery,
claim-crash/reclaim, queue-ack-before-published crash, duplicate execution,
worker retry, queued-without-worker then worker start, and AI unavailable. Both
crash windows and duplicate delivery converge to one Proposal effect. AI
unavailability leaves Capture and RawPayload intact, emits no malformed Proposal
or `proposal.ready`, and remains observable as a failed/retried BullMQ job.

## PostgreSQL SSE evidence

`GET /api/v1/stream` is the frozen authenticated route. It reads committed
PostgreSQL Outbox sequence only; Worker does not emit SSE and Redis Pub/Sub is
not used. Actor scope is derived from canonical ownership joins for Task,
TimeBlock, Capture, and Proposal-target Capture. Client actor IDs, query owner
parameters, and payload owner hints are never trusted.

SSE eligibility is an explicit allowlist of `object.changed` and
`proposal.ready`; `capture.triage.requested` is always invisible. Decimal
Outbox sequence strings are used directly as event IDs, so internal-trigger
sequence gaps are valid and BIGINT values never pass through JavaScript Number.
No Last-Event-ID establishes the current durable cursor and receives future
events. A valid cursor replays newer eligible actor-owned events in order,
including already-published history. The bounded limit counts eligible,
actor-owned events only; overflow emits frozen `system.resync-required` without
business payload. Comments provide immediate connection flush and heartbeat,
neither of which is a business event or invalidation.

Real `next build --webpack` + `next start` + Node streaming fetch proves valid
stream authentication, missing/expired/revoked rejection, initial connection,
ordered Last-Event-ID replay, cross-Actor isolation, internal trigger filtering,
BIGINT-safe cursor, bounded resync, heartbeat, abort/disconnect cleanup, and
absence of raw Capture text. Production Web build includes `/api/v1/stream` and
finishes without warnings.

## TanStack Query evidence

The client foundation uses the approved `@tanstack/react-query@5.101.4` already
in the frozen lock. Only the currently implemented frozen Task GET has a real
query key:

```text
["task", clientAuthEpoch, taskId]
```

One shared mapper converts `affectedRefs + projectionHints` into exact query
keys for both HTTP MutationResult and SSE. It calls
`invalidateQueries({queryKey, exact:true})`; there is no unfiltered global
invalidation. Real QueryClient tests prove the affected Task is invalidated
while an unrelated Task and the same Task under another auth epoch remain
untouched. Unknown/unreadable projections fail closed. Auth epoch creation and
rotation are client-local cache/offline partitions and never server authority.

## Offline Capture evidence

Offline support is restricted to the frozen `capture.create` OfflineCommand and
its exact `pending | syncing | conflict | done | failed` states. The browser
boundary uses `uuid@14.0.1` v7 for a stable local ID/Idempotency-Key and
`globalThis.crypto.subtle` for the canonical fingerprint. The production store
uses only native `globalThis.indexedDB` and waits for transaction completion. It
does not use localStorage, fake-indexeddb, Dexie, idb, localForage, a Service
Worker, Workbox, or PWA machinery.

The production HTTP adapter replays the exact validated CreateCapture payload to
the frozen `/api/v1/captures` route with the original Idempotency-Key. Successful
sync marks done; an idempotency conflict is explicit; 401 retains the command and
blocks automatic retry; an auth-epoch mismatch becomes conflict without sending
under the new session. Lost acknowledgement retries the byte-stable payload/key
and relies on the already-proven server idempotency to yield one RawPayload,
Capture, ChangeRecord, `object.changed`, and `capture.triage.requested`. Proposal
Apply, TimeBlock Move, Task completion, and external writes have no offline path.

Browser-native IndexedDB persistence remains an explicit Stage 8 browser E2E
proof debt. Stage 6 acceptance covers the real pure state machine plus compiled,
statically audited production adapter, exactly as authorized; no Chromium was
downloaded.

## Verification and recovery history

The final canonical verification passed in 97.1 seconds:

```text
pnpm verify: PASS
CI policy self-test: PASS
lint: PASS
strict typecheck: 8 / 8 workspaces
boundary: 8 workspaces, 96 source files, 7 manifest edges
boundary negative self-test: PASS, 63 expected violations
OpenAPI deterministic check: PASS
token check: PASS, 29 files
Domain: 9 / 9
Application: 9 / 9
Contracts: 12 / 12 plus drift negative
TanStack + Offline: 10 / 10
PostgreSQL/Dispatcher/BullMQ/SSE: 43 / 43
Worker build/smoke: PASS
Web production build/smoke: PASS
Stage 3 + 4 + 5 + 6 production HTTP integration: PASS
```

Before final verification, two fresh rebuild cycles each started from an empty
PostgreSQL 18.4 volume, applied 0000–0004, ran 43 / 43 database/async tests, and
destroyed PostgreSQL/Redis resources. Both reported migration count 5.

The first async integration run exposed test-file concurrency and compiled
Worker-path issues; the next run passed all 42 assertions but correctly reported
an unhandled asynchronous Redis test disconnect. Test orchestration/cleanup was
fixed, not production durability. A later real streaming test exposed that Node
fetch waits for an initial body chunk; the standard non-business `: connected`
SSE comment fixed response flushing. Final tests include the additional
post-trigger rollback case, for 43 total.

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
0003 SHA-256: fefa9806107faf7b057479f93ce5176e0e3a6ddc8ddec97dad24e4a99bddc1f5
migration count: 5
0005: absent
internal topic in OpenAPI/SSE Contract: 0
Worker direct database imports: 0
unfiltered global invalidation: 0
forbidden offline transports/dependencies: 0
queue sensitive-field matches: 0
Stage project containers: 0
Stage project volumes: 0
listeners on 43117 / 55432 / 56379: 0 / 0 / 0
git diff --check: PASS
```

Dependency delta is zero; the lockfile and frozen OpenAPI are byte-unchanged.
No product UI, Review/Plan/Execution object, provider, Connector, WebSocket,
CRDT, Redis Pub/Sub, new business table, Capture lifecycle field, Chromium,
commit, staging, push, Stage 7 work, or Gate 4.2 work was performed.
