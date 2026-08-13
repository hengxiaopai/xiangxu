# ADR-G4.1-001 — Revision and HTTP Concurrency

Date: 2026-08-12
Status: **DECIDED; implementation not started**
Scope: Gate 4.1 contract clarification only

## Context

Gate 3.8 correctly freezes PostgreSQL `revision` as `bigint >= 1`, maps a
single-resource revision to an HTTP ETag such as `"rev-17"`, and uses `bigint`
in `RevisionedRepository.updateCas`. Some TypeScript and JSON examples in the
same document use JavaScript `number`. A database `bigint` can exceed the exact
integer range of a JavaScript number, so retaining those examples would make
the transport and UI contracts lossy.

This ADR clarifies representation only. It does not change the monotonic
revision invariant, authorize last-write-wins, or add a new business feature.

## Decision

| Boundary | Frozen representation |
| --- | --- |
| PostgreSQL | `bigint NOT NULL DEFAULT 1 CHECK (revision > 0)` |
| Domain/Application | branded `bigint` named `Revision` |
| Application CAS | `baseRevision: Revision` |
| HTTP ETag and If-Match | quoted strong validator `"rev-N"` |
| JSON DTO revision | positive canonical decimal string |
| OfflineCommand `baseRevision` | positive canonical decimal string |
| Proposal target `baseRevision` | positive canonical decimal string |
| UI confirmed revision | positive canonical decimal string |

`N` has no sign, whitespace, leading zero, exponent, fraction, or alternate
base. The canonical grammar is `[1-9][0-9]*`. JSON and React code must not
convert a revision to a JavaScript number. The transport adapter parses the
canonical decimal string to the branded `bigint` at the Application boundary
and formats a branded revision back to a decimal string on output.

## Gate 3.8 examples clarified

The following Gate 3.8 examples are normative in intent but clarified in type:

| Gate 3.8 example | Clarified form |
| --- | --- |
| `Application Command.base_revision = 17` | Application value is branded `17n`; JSON form is `"17"` |
| `CommandEnvelope.baseRevision?: number` | `baseRevision?: Revision` inside Application; transport DTO uses `string` |
| `EvidenceResultDTO.revision: number` | `revision: string` |
| RFC 9457 `conflict.currentRevision: 18` | `conflict.currentRevision: "18"` |
| `ProposalDTO.targets[].baseRevision: number` | `baseRevision: string` |
| `ResolvedWorkspaceDescriptorDTO.space.revision: number` | `revision: string` |
| `ResolvedWorkspaceDescriptorDTO.configRevision: number` | `configRevision: string` |
| `OfflineCommand.baseRevision?: number` | `baseRevision?: string` |
| `UICommandIntent task.complete.baseRevision: number` | `baseRevision: string` |
| `UICommandIntent timeblock.move.baseRevision: number` | `baseRevision: string` |
| SSE `object.changed` new revision | positive decimal string |
| Successful command DTOs containing a new revision | positive decimal string; response ETag carries the same value |

Fields named `descriptorVersion`, capability versions, cursor sequence numbers,
counts, durations, scores, and domain estimates are not Fact revisions and are
not changed by this ADR.

## If-Match and CAS mapping

| Condition | HTTP result | Frozen problem code |
| --- | --- | --- |
| Required `If-Match` absent | `428` | `PRECONDITION_REQUIRED` |
| Header present but malformed | `400` | `VALIDATION_ERROR` |
| Well-formed ETag differs from current revision | `412` | `PRECONDITION_FAILED` |
| Application/Domain CAS loses after validation | frozen revision-conflict problem profile; never silent LWW | `REVISION_CONFLICT` |

The transport must reject weak validators, wildcard validators, unquoted
values, multiple validators, `rev-0`, signed values, leading-zero values, and
values outside the supported PostgreSQL positive bigint range. A command must
carry exactly the revision parsed from the validated `If-Match`; a JSON body
cannot override it.

Proposal Apply is different: no Proposal public ETag is invented. Each target
Fact uses its stored base revision and the proposal lifecycle transition is a
guarded status CAS (`ready -> applied`).

## Consequences and acceptance

- DB adapters use PostgreSQL bigint-safe parsing; no implicit number coercion.
- DTO schemas and OpenAPI describe revision values as strings with the
  canonical decimal pattern.
- Query keys and UI state retain the string value unchanged.
- Contract tests must cover values above `Number.MAX_SAFE_INTEGER`.
- Domain implementation cannot start until review accepts this ADR.

Gate 4.1 Stage 1 has not started. Gate 4.2 has not started.
