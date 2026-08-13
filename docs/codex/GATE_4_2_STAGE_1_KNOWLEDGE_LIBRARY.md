# Gate 4.2 Stage 1 — Library Foundation + Knowledge Overview

Status: **PASS**
Date: 2026-08-13
Next: Gate 4.2 Stage 2 not started; Gate 4.3 not started.

## Authorized Scope

The upstream roadmap names Gate 4.2 as Knowledge Core. This first bounded slice implements the smallest honest user-visible loop that does not bypass the frozen Capture → Proposal → Fact architecture:

- create an owner-scoped Library support entity;
- list only the current actor's Libraries;
- expose a real Knowledge Overview projection;
- persist the write transactionally with idempotency, ChangeRecord and Outbox;
- deliver actor-scoped SSE/TanStack invalidation;
- render `/app/knowledge` from real DTOs without sample business data.

The following are explicitly not implemented: direct Resource creation, Capture-to-Resource Proposal expansion, Library membership, Reading Queue mutation, Resource/Note/Knowledge/Topic/Relation facts, Search/Resurface, provider AI, upload/connectors, Explore, Gate 4.2 Stage 2, and Gate 4.3.

## Source Alignment

- PRD KNW-01–04: multi-Library identity, Overview metrics, Reading Queue and evidence-backed reading rationale.
- Domain DINV-08: Library membership must never duplicate Resource/Note/Knowledge identity.
- SDD/API: `GET /knowledge/overview`, `GET/POST /libraries`, Application Commands, Idempotency-Key, ChangeRecord, Outbox and server-resolved Actor.
- UI Design System and approved `07-knowledge.png`: Light Quiet overview, metric strip, Library cards, action-oriented reading queue, contextual rail, responsive Light/Dark behavior.

Stage 1 intentionally shows truthful zero Resource metrics and an explicit unavailable-evidence state. It does not fabricate reading items, topics, projects or AI recommendations.

## Implementation

- Pure Domain `Library` invariant: trimmed non-empty name; owning user Actor only; immutable value.
- Additive transport contracts: Library DTO, Knowledge Overview DTO, CreateLibrary command, `library` ref, `knowledge` projection hint and deterministic OpenAPI routes.
- Application `KnowledgeHandlers`: server Actor ownership, idempotent CreateLibrary, owner-scoped list/overview, ChangeRecord and Outbox in one transaction.
- Migration `0006_past_ares.sql`: creates `knowledge` schema and `knowledge.libraries` only; no drop, rename, destructive rewrite or data backfill.
- PostgreSQL repository: owner-filtered reads, stable order, no client owner input.
- SSE: Library eligibility is resolved through `knowledge.libraries.owner_id`; `object.changed` carries revision token `1` and `knowledge` projection hint.
- Web: `/api/v1/knowledge/overview`, `/api/v1/libraries`, `/app/knowledge`, single existing QueryClient/Auth Epoch/SSE invalidation path.
- UI: eight-surface navigation visibility with unopened routes rendered as disabled labels; real Library form/list; explicit empty Reading Queue and AI evidence state; responsive Light/Dark layout.

No production dependency or lifecycle policy changed.

## Migration Review

`pnpm db:generate` generated migration 0006. Manual review found only:

1. `CREATE SCHEMA IF NOT EXISTS knowledge`;
2. `CREATE TABLE knowledge.libraries`;
3. owner foreign key, non-empty-name/owner-Actor checks;
4. owner/created-at index.

A second `pnpm db:generate` reported `No schema changes, nothing to migrate`.

## Verification Evidence

| Verification | Result |
|---|---|
| Handoff pre-work SHA-256 | PASS — 32/32; manifest `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` |
| Handoff post-work SHA-256 | PASS — 32/32; same manifest hash |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS — 8/8 packages |
| `pnpm boundary` / `pnpm boundary:test` | PASS — 121 sources; positive pass, negative 63 expected violations |
| Contracts generation/check/drift | PASS — byte-stable OpenAPI; negative drift rejected |
| `pnpm tokens:check` | PASS — raw primitives confined to token source |
| Domain / Contracts / Application tests | PASS — 12 / 13 / 13 |
| Web smoke/state tests | PASS — 19; `/login`, Today, Knowledge and Review production routes |
| PostgreSQL two-cycle rebuild | PASS — each cycle 6 files, 53/53 tests, migration count 7, PostgreSQL 18.4, cleanup zero |
| Production HTTP integration | PASS — Library create/replay, malicious owner rejection, actor isolation, Overview, audit, Outbox and SSE |
| `pnpm verify` | PASS — CI policy, lint, types, boundaries, contracts/tokens, test/build graphs, PostgreSQL 18.4, Redis 8.2.8, BullMQ, HTTP, cleanup |
| Targeted Knowledge Chromium journey | PASS — keyboard navigation/create, SSE refresh, reload persistence, second-user isolation, no secret surface |
| Strict responsive visual proof | PASS — Gate 4.2 owns 29 versioned baselines: preserved 25-state regression set plus 4 Knowledge desktop/mobile Light/Dark screenshots; zero diff after reviewed update |
| Full Chromium semantic regression | PASS — 11/11 authentication, Daily Loop, Knowledge, SSE restart, IndexedDB/offline/Auth Epoch, keyboard/a11y and reduced motion |

The first database attempt was blocked before tests by an unrelated host `6379` listener. Project containers/network/volume were cleaned. The reviewed test-only host port override `XIANGXU_STAGE5_REDIS_TEST_PORT=56379` was used; Redis image/version and container semantics were unchanged.

During visual review, the first mobile Knowledge baseline exposed a real rail overlap because App CSS custom media was outside the UI expansion boundary. The rule was moved to `packages/ui/src/daily-loop-responsive.css`; regenerated mobile Light/Dark screenshots show a single-column flow without overlap or horizontal overflow. Historical Gate 4.1 PNGs remain byte-preserved in their original directory; current baselines live under `artifacts/browser/gate-4.2-stage-1`. Update mode was not counted as proof: strict mode subsequently passed the 22-shot matrix plus the 4 Knowledge states.

## Stage Decision

Gate 4.2 Stage 1 acceptance criteria are satisfied. The implementation is a real, persisted and actor-isolated product slice, not a static mock. Gate 4.2 Stage 2 remains unopened and must preserve Capture → Proposal → Fact for Resource materialization.
