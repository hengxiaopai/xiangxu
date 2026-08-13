# 向序 XIANGXU

Personal AI Work OS — engineering repository bootstrap.

> **Gate 4.1 is closed at exact commit `800aaca815038464bc09ee0b8e6d2d922a23c2dc`. Gate 4.2 Knowledge Core is active.**

## Current Status

- Current Gate: Gate 4.2 — Knowledge Core; Stage 1, Library Foundation + Knowledge Overview, is complete. Stage 2 has not started.
- Gate 4.1 Stage 0 passed dependency/native/lifecycle review, revision/HTTP contract clarification, Playwright Chromium dry-run provenance, path-aware Web server-composition boundaries, frozen installation, native tooling smoke, and unified verification.
- Gate 4.1 Stage 1 passed Contracts + Pure Domain freeze, real Vitest coverage, deterministic OpenAPI, boundary enforcement, and unified verification.
- Gate 4.1 Stage 2 passed additive migration 0001, real PostgreSQL CAS/concurrency/transaction/idempotency integration tests, two fresh rebuild cycles, and unified verification.
- Gate 4.1 Stage 3 passed production-profile fail-closed Dev Session, server-resolved Actor, transactional Task HTTP runtime, ETag/If-Match CAS, idempotent replay/concurrency/conflict, cross-actor isolation, real PostgreSQL 18.4 production-build integration, and unified verification.
- Gate 4.1 Stages 4–6 passed TimeBlock, Capture/Proposal/Apply, and durable Outbox/BullMQ/SSE/TanStack/Offline foundations.
- Gate 4.1 Stage 7 passed immutable Plan/Review snapshots, traceable deterministic Plan-vs-Actual, zero-fabricated actual timing, actor-scoped Today/Review, bounded `/app/today` and `/app/review` UI, production HTTP integration, two clean rebuilds, and unified verification.
- Gate 4.1 Stage 8 passed production Chromium E2E, actor isolation, responsive Light/Dark visual baselines, keyboard/reduced-motion accessibility, real IndexedDB reload/offline/Auth Epoch safety, and unified verification.
- Gate 4.1 Stage 9 passed final publication recovery and exact-commit Hosted CI for `800aaca815038464bc09ee0b8e6d2d922a23c2dc`; Gate 4.1 is closed.
- Gate 4.2 Stage 1 implements a real owner-scoped Library Fact: Domain invariant, Application command/query ports, additive migration 0006, PostgreSQL repository, idempotency, ChangeRecord, Outbox/SSE, additive OpenAPI, actor-scoped TanStack invalidation, `/app/knowledge`, responsive Light/Dark UI, and real production-browser proof. Resource materialization, membership, Reading Queue mutation, Note/Topic/Relation, Search/Resurface and Explore remain later stages.
- Completed evidence: Stage 0 environment/dependency review, Stage 1 repository governance, Stage 2 workspace layering/import-boundary enforcement, Stage 3 Web/Worker runtime shells, Stage 4 Contracts/UI foundation, Stage 5 Data/Queue foundation, Stage 6 Unified Verification/CI, and Stage 7 Browser/Visual Evidence.
- Real provider AI, Connectors, Scene Packs, WebGL and advanced Knowledge Explore remain out of scope. Disabled navigation labels are roadmap visibility, not fake functional routes.
- Stage 4 passed deterministic Contracts generation/drift detection, Light/Dark semantic tokens, minimal UI components, Web integration, and unified verification.
- Stage 5 passed PostgreSQL 18.4 clean rebuild, deterministic Drizzle migration, Redis 8.2.8 health, BullMQ pure-JavaScript fake-job smoke, boundary enforcement, and unified verification.
- Stage 6 passed public-repository publication safety, fresh frozen install, the shared `pnpm verify` entry point, and GitHub Actions run `31553121149` on exact commit `964a965dfd6b6161c3a55f30fc557b255a68fea1` using `ubuntu-24.04`.
- Stage 7 passed the eight-state Light/Dark desktop/mobile browser matrix, responsive and semantic checks, real keyboard Enter activation, deterministic evidence hashing, frozen installation, and unified verification.
- Stage 8 Phase A local final audit passed and final publication was explicitly authorized. Gate 4.0 closes only when `origin/main` and a successful GitHub Hosted Runner `head_sha` equal the exact final Gate commit.

## Prerequisites

- Node.js `24.19.0`
- pnpm `11.21.0`
- Git

Docker Desktop with PostgreSQL 18.4 and Redis 8.2.8 is required for Stage 5 infrastructure smoke commands.

## Install

Use the exact runtime and package manager above, then run:

```powershell
pnpm install --frozen-lockfile
```

The project uses `https://registry.npmjs.org/` through repository-level configuration. Do not change user-global registry settings for this repository.

## Root Commands

```powershell
pnpm lint
pnpm typecheck
pnpm boundary
pnpm boundary:test
pnpm ci:check
pnpm contracts:generate
pnpm contracts:check
pnpm contracts:drift:test
pnpm tokens:check
pnpm browser:check
pnpm browser:evidence
pnpm db:generate
pnpm db:migrate
pnpm db:smoke
pnpm db:rebuild:smoke
pnpm queue:smoke
pnpm infra:smoke
pnpm stage3:http:smoke
pnpm web:build
pnpm web:smoke
pnpm worker:build
pnpm worker:smoke
pnpm test
pnpm build
pnpm verify
```

The package boundaries remain enforced. Gate 4.2 Stage 1 evidence is recorded in `docs/codex/GATE_4_2_STAGE_1_KNOWLEDGE_LIBRARY.md`.

## Intended Architecture

```text
apps/web, apps/worker
        |
packages/infrastructure
        |
packages/application
        |
packages/domain
```

Contracts and UI join only through explicit typed boundaries. The detailed rules live in root and nested `AGENTS.md` files.

## Source of Truth

- Handoff package: `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/` — read only.
- Upstream roadmap and immutable references: `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/`; current repository Gate state is frozen in root `AGENTS.md`.
- Repository evidence: `docs/codex/`.
