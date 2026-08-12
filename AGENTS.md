# XIANGXU Repository Instructions

## Current Gate

- Current gate: **Gate 4.0 — engineering bootstrap only**.
- Current completed stage: **Stage 7 — Browser & Visual Evidence**.
- Stage 5 passed PostgreSQL 18.4 clean rebuild, deterministic Drizzle migration, Redis 8.2.8 health, BullMQ pure-JavaScript fake-job smoke, boundary enforcement, and unified verification on 2026-08-12.
- Stage 5 lifecycle policy allows three exact esbuild versions and explicitly denies exact `msgpackr-extract@3.0.4`; every other lifecycle/build script remains denied.
- Stage 6 passed publication safety, SHA-pinned GitHub Actions policy, fresh frozen installation, unified verification, infrastructure cleanup, and a real `ubuntu-24.04` hosted run for exact commit `964a965dfd6b6161c3a55f30fc557b255a68fea1` on 2026-08-12.
- Stage 7 passed the eight-state Light/Dark desktop/mobile screenshot matrix, responsive geometry and semantic checks, real Chrome Tab/Shift+Tab/Enter activation, deterministic artifact hashing, frozen installation, and unified verification on 2026-08-12.
- Stage 8 Phase A local final audit passed on 2026-08-12, and final publication was explicitly authorized on 2026-08-12.
- Current Stage 8 status remains **BLOCKED — final publication and exact-commit hosted CI closure pending** until `origin/main` and the successful Actions `head_sha` both equal the final Gate commit.
- Only the reviewed Stage 7/8 evidence set may be committed and normally pushed to `origin/main`; force push, tags, releases, product work, and Gate 4.1 remain unauthorized.
- Never start Gate 4.1 without an explicit human PASS.
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

## Stage Ownership

- Stage 1: repository governance and toolchain foundation.
- Stage 2: workspace package layering and boundary enforcement.
- Stage 3: Web and Worker shells.
- Stage 4: Contracts and UI foundation.
- Stage 5: PostgreSQL, Drizzle, Redis, and BullMQ infrastructure smoke.
- Stages 6–8: unified verification, browser evidence, and Gate report.

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
