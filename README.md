# 向序 XIANGXU

Personal AI Work OS — engineering repository bootstrap.

> **Gate 4.0 engineering bootstrap only. No production business workflow implemented.**

## Current Status

- Current Gate: Gate 4.0.
- Completed evidence: Stage 0 environment/dependency review, Stage 1 repository governance, Stage 2 workspace layering/import-boundary enforcement, Stage 3 Web/Worker runtime shells, Stage 4 Contracts/UI foundation, Stage 5 Data/Queue foundation, Stage 6 Unified Verification/CI, and Stage 7 Browser/Visual Evidence.
- Stage 3 passed frozen installation, production build, Web HTTP smoke, Worker runtime smoke, and unified verification.
- Web and Worker contain runtime shells only. No authentication, Task, Calendar, Inbox, Proposal, AI, Connector, business database schema, or real queue workflow exists yet.
- Stage 4 passed deterministic Contracts generation/drift detection, Light/Dark semantic tokens, minimal UI components, Web integration, and unified verification.
- Stage 5 passed PostgreSQL 18.4 clean rebuild, deterministic Drizzle migration, Redis 8.2.8 health, BullMQ pure-JavaScript fake-job smoke, boundary enforcement, and unified verification.
- Stage 6 passed public-repository publication safety, fresh frozen install, the shared `pnpm verify` entry point, and GitHub Actions run `31553121149` on exact commit `964a965dfd6b6161c3a55f30fc557b255a68fea1` using `ubuntu-24.04`.
- Stage 7 passed the eight-state Light/Dark desktop/mobile browser matrix, responsive and semantic checks, real keyboard Enter activation, deterministic evidence hashing, frozen installation, and unified verification.
- Stage 8 Phase A local final audit passed and final publication was explicitly authorized. Gate 4.0 closes only when `origin/main` and a successful GitHub Hosted Runner `head_sha` equal the exact final Gate commit.
- Gate 4.1 has not started.

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
pnpm web:build
pnpm web:smoke
pnpm worker:build
pnpm worker:smoke
pnpm test
pnpm build
pnpm verify
```

The Stage 2 package boundaries remain enforced. Stage 5 evidence is recorded in `docs/codex/GATE_4_0_STAGE_5_DATA_QUEUE.md`. Stage 6 local evidence and the CI publication checkpoint are recorded in `docs/codex/GATE_4_0_STAGE_6_CI.md`. Stage 7 browser evidence is recorded in `docs/codex/GATE_4_0_STAGE_7_BROWSER_EVIDENCE.md`. The Stage 8 local final audit and publication checkpoint are recorded in `docs/codex/GATE_4_0_FINAL_REPORT.md`.

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
- Active Gate: `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/CURRENT_GATE.md`.
- Repository evidence: `docs/codex/`.
