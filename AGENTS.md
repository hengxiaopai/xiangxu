# XIANGXU Repository Instructions

## Current Gate

- Current gate: **Gate 4.1 — Daily Loop Vertical Slice**.
- Current completed implementation stage: **Stage 8 — Production Chromium E2E + Responsive + A11y + Visual + IndexedDB Proof**.
- Stage 9 local final audit passed on 2026-08-13. Publication remains pending a separate explicit human authorization; no commit, push, or hosted exact-commit CI closure has been performed.
- Stage 3 passed production-profile fail-closed Dev Session, secure hash-only session persistence, server Actor resolution, actor isolation, transactional Create/Complete with PostgreSQL CAS/ChangeRecord/Outbox/Idempotency, real production-build HTTP integration, and unified verification on 2026-08-13.
- Stage 0 passed exact dependency/native/lifecycle review, observable pnpm resolver recovery, Chromium-only Playwright dry-run provenance, deterministic frozen installation, native tooling smoke, revision/HTTP ADR, path-aware Web composition boundary fixtures, and unified verification on 2026-08-12.
- Stage 1 passed pure Domain values/invariants, Application command/query intents, transport DTOs, RFC 9457, ETag/If-Match, typed Proposal, versioned SSE, deterministic OpenAPI, boundary enforcement, and unified verification on 2026-08-12.
- Stage 2 passed additive migration 0001, two-cycle fresh PostgreSQL 18.4 replay, Task repository/CAS, PgUnitOfWork, append-only ChangeRecord, transactional Outbox, durable Idempotency, session hash persistence, boundary enforcement, and unified verification on 2026-08-12.
- Stage 4 passed the Recovery-scoped Create/Move-only contract, additive migration 0002, owner-scoped PostgreSQL advisory locking, half-open overlap enforcement, TimeBlock CAS/ChangeRecord/Outbox/Idempotency, actor isolation, locked actor policy, two-cycle PostgreSQL 18.4 rebuild, real production-build HTTP integration, and unified verification on 2026-08-13. No direct TimeBlock GET was added.
- Gate 4.1 Stage 5 passed the Frozen Contract and typed-patch audit, additive migration 0003, immutable text RawPayload, deterministic structured `task.create` Proposal, Worker-to-Application execution, explicit transactional Apply, stale/concurrency/actor isolation, two-cycle PostgreSQL 18.4 rebuild, real production-build HTTP integration, and unified verification on 2026-08-13. No provider SDK, auto-Apply, direct Worker database access, Proposal GET, Capture GET, dispatcher, SSE, TanStack, offline storage, or Stage 6 implementation was added.
- Gate 4.1 Stage 6 passed Human Recovery ADR-G4.1-002, constraint-only migration 0004, atomic `capture.triage.requested`, concurrent/recoverable Outbox dispatch, deterministic BullMQ-to-Stage-5-Worker/Application execution, actor-scoped PostgreSQL SSE replay, exact TanStack invalidation, native IndexedDB Offline Capture foundation, two-cycle PostgreSQL 18.4 rebuild, real production-build streaming HTTP integration, and unified verification on 2026-08-13.
- Gate 4.1 Stage 7 passed frozen Plan/Review Contract audit, additive migration 0005, immutable Plan/Review snapshots, safe daily version allocation, zero-fabricated ExecutionRecord semantics, traceable deterministic Review, actor-scoped Today/Review/SSE, bounded token-first `/app/today` and `/app/review` UI, two-cycle PostgreSQL 18.4 rebuild, real production-build HTTP integration, and unified verification on 2026-08-13.
- Gate 4.1 Stage 8 passed real production-stack bundled-Chromium verification, actor-isolated authentication/SSE/TanStack behavior, real IndexedDB reload/offline/Auth Epoch safety, two independent reviewed visual-baseline runs, responsive Light/Dark and keyboard/reduced-motion accessibility audits, frozen artifact checks, and unified verification on 2026-08-13.
- Gate 4.1 Stage 9 local audit passed clean-room frozen installation, deterministic migration generation, two-cycle PostgreSQL rebuild, unified verification, production Chromium verification, publication-set safety review, and Handoff integrity checks on 2026-08-13. Stage 9 is not formally closed until separately authorized publication and exact-commit hosted CI succeed.
- Gate 4.2 has not started.
- Stage 5 passed PostgreSQL 18.4 clean rebuild, deterministic Drizzle migration, Redis 8.2.8 health, BullMQ pure-JavaScript fake-job smoke, boundary enforcement, and unified verification on 2026-08-12.
- Lifecycle policy allows exact `esbuild@0.18.20`, `esbuild@0.25.12`, and `esbuild@0.28.2`; explicitly denies exact `msgpackr-extract@3.0.4` and `fsevents@2.3.2`; every other lifecycle/build script remains denied.
- Stage 6 passed publication safety, SHA-pinned GitHub Actions policy, fresh frozen installation, unified verification, infrastructure cleanup, and a real `ubuntu-24.04` hosted run for exact commit `964a965dfd6b6161c3a55f30fc557b255a68fea1` on 2026-08-12.
- Stage 7 passed the eight-state Light/Dark desktop/mobile screenshot matrix, responsive geometry and semantic checks, real Chrome Tab/Shift+Tab/Enter activation, deterministic artifact hashing, frozen installation, and unified verification on 2026-08-12.
- Stage 8 Phase A local final audit passed on 2026-08-12, and final publication was explicitly authorized on 2026-08-12.
- Gate 4.0 final publication and exact-commit hosted CI closure passed for commit `a3183a026fea893b66c7b72dd65ce0f15d7fa572`.
- Work only inside the Stage named by the active task.

## Source of Truth

Resolve conflicts in this order:

1. Security, Privacy, and Domain invariants.
2. Gate 3.8 SDD/API contracts.
3. Gate 3.7 UI Design System.
4. `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/DESIGN_RULES.md`.
5. Approved UI references.
6. Current Gate and active task.
7. Skills, plugins, and library defaults.

The handoff package is the upstream reference. Do not invent replacement product or architecture rules in repository code.

## Handoff Immutability

`XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/` is **READ ONLY**:

- do not move, rename, format, rewrite, or auto-fix it;
- verify all 32 manifest-listed SHA-256 hashes before and after material repository operations;
- do not run tools against it that may modify files.

## Dependency Governance

- Use Node `24.19.0` and pnpm `11.21.0` exactly.
- Use the official npm registry through project-level configuration only.
- All direct dependency versions are exact; do not use `latest`, `next`, `*`, caret, or tilde ranges.
- Do not add a production dependency without a recorded dependency review and human approval.
- Do not execute an unknown lifecycle/build script. pnpm `allowBuilds` is deny-by-default and package-specific.
- Never use `dangerouslyAllowAllBuilds`.

## Architecture Direction

The future dependency direction is:

```text
domain <- application <- infrastructure <- apps
                      ^
                  contracts / ui at explicit boundaries
```

- `domain` stays pure TypeScript and cannot import Next, React, Zod, Drizzle, PostgreSQL, Redis, BullMQ, or Provider SDKs.
- Fact writes must eventually flow through Application Commands with revision/idempotency controls.
- UI consumes DTOs and semantic props, never database rows.
- Apps and workers cannot bypass application boundaries to mutate Domain data.

Stage 2 enforces these rules through `tools/boundary/boundary-matrix.json`, manifest/source checks, and positive/negative fixtures. Later Stages may expand only their explicitly approved edges.

## Gate 4.1 Stage Ownership

- Stage 1: Contracts + Pure Domain.
- Stage 2: reviewed DB migration + infrastructure foundation.
- Stage 3: dev session + Create/Complete Task.
- Stage 4: TimeBlock.
- Stage 5: Capture + Proposal + Apply.
- Stage 6: Outbox + Worker + SSE + TanStack + Offline Capture.
- Stage 7: Plan / Execution / Review + bounded UI.
- Stage 8: full E2E / visual / accessibility / recovery.
- Stage 9: final Gate audit/publication checkpoint.

Do not create later-Stage implementation to make the current Stage look complete.

## Root Commands

- `pnpm lint`: the only lint entry; do not add `next lint` or a second linter.
- `pnpm typecheck`: workspace typecheck task graph.
- `pnpm test`: workspace test task graph.
- `pnpm build`: workspace build task graph.
- `pnpm web:build` / `pnpm web:smoke`: Stage 3 Web production build and HTTP smoke.
- `pnpm worker:build` / `pnpm worker:smoke`: Stage 3 Worker compile and runtime smoke.
- `pnpm boundary`: validate the real workspace manifests and source imports.
- `pnpm boundary:test`: prove legal fixtures pass and illegal fixtures fail.
- `pnpm contracts:generate` / `pnpm contracts:check`: generate and verify the deterministic OpenAPI artifact.
- `pnpm contracts:drift:test`: prove a temporary contract mutation is rejected.
- `pnpm tokens:check`: enforce the centralized token boundary in UI consumers.
- `pnpm browser:check`: validate the recorded real-keyboard Tab/Shift+Tab/Enter activation evidence.
- `pnpm browser:evidence`: validate the eight-state screenshot manifest, PNG hashes, and keyboard evidence.
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:smoke`: Stage 5 versioned-migration commands.
- `pnpm db:rebuild:smoke`: guarded two-cycle clean PostgreSQL rebuild proof.
- `pnpm queue:smoke` / `pnpm infra:smoke`: Stage 5 Redis/BullMQ and combined infrastructure smoke.
- `pnpm ci:check`: validate the Stage 6 GitHub Actions policy and prove the checker with a negative fixture.
- `pnpm verify`: CI policy, lint, strict typecheck, boundary checks, boundary self-test, contracts/token checks, test/build graphs, and Stage 5 infrastructure smoke.

Never skip or weaken a required test, strict compiler option, lint rule, or boundary rule to obtain a passing result.
