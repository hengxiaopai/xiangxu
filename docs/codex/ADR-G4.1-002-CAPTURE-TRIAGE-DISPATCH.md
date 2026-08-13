# ADR-G4.1-002 — Capture Triage Durable Dispatch Intent

- Status: Accepted by explicit human Recovery decision
- Date: 2026-08-13
- Gate: Gate 4.1 / Stage 6 Recovery

## Context

The durable Outbox previously allowed only `object.changed` and
`proposal.ready`. Neither can unambiguously request Proposal generation:

- `object.changed` is a browser projection invalidation emitted for Task,
  TimeBlock, Capture creation, and Capture Apply;
- `proposal.ready` is emitted only after Proposal generation has committed.

Inferring a job from object type, revision, Capture status, ChangeRecord, or
idempotency state would make dispatcher behavior depend on incidental Fact
shape. Direct HTTP-to-BullMQ dispatch would also break the committed PostgreSQL
Outbox boundary.

## Decision

Introduce exactly one internal durable Outbox topic:

```text
capture.triage.requested
```

Its only meaning is: a newly committed Capture requests structured triage
Proposal generation.

The producer is the first successful `CreateCapture` Application transaction.
It appends both `object.changed` and `capture.triage.requested` before completing
idempotency and committing. Exact HTTP replay returns the stored result and
does not append either event again.

The only dispatch routing is:

```text
capture.triage.requested -> capture.triage.generate
object.changed           -> no business job
proposal.ready            -> no business job
```

The consumer is the Outbox Dispatcher. BullMQ binds the internal logical job
`capture.triage.generate` to the existing Stage 5
`GenerateStructuredTriageProposal` processor through Application.

Worker and BullMQ identities derive deterministically from the immutable
trigger Outbox event ID. BullMQ duplicate suppression is a transport guard;
Application idempotency remains the correctness guard.

The job payload contains immutable references and identities only. The Worker
does not trust a payload owner: Application reloads the canonical Capture and
derives its owner before executing as the system actor.

## Boundaries

- `capture.triage.requested` is not a Fact or public Domain event.
- It is never exposed through SSE or OpenAPI.
- SSE continues to expose only eligible frozen event types and may have gaps in
  its decimal durable-sequence IDs.
- No Capture triage lifecycle field and no job table is added.
- PostgreSQL Outbox remains authoritative; Redis/BullMQ remains execution
  transport.
- Worker does not access PostgreSQL or repositories directly.

## Persistence

Migration `0004` is authorized only to replace the existing
`infra.outbox_events.topic` CHECK constraint so the allowlist becomes:

```text
object.changed
proposal.ready
capture.triage.requested
```

No table, column, index, foreign key, data rewrite, or earlier migration change
is authorized.

## Consequences

Capture HTTP returns after its PostgreSQL transaction and does not wait for
Proposal generation. Redis, Worker, or generator failure cannot roll back the
Capture/RawPayload. Claim/retry and BullMQ retry eventually execute the same
logical Application command, yielding at most one Proposal effect.
