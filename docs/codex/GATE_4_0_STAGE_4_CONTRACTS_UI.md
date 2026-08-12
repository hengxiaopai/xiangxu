# XIANGXU Gate 4.0 / Stage 4 Contracts & UI Foundation Evidence

> Stage: Gate 4.0 / Stage 4 — Contracts & UI Foundation  
> Audited at: 2026-08-11T21:33:48+08:00  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 4 PASS**  
> Stage 5: not started  
> Gate 4.1: not started

## 1. Result and Scope

Stage 4 established only the approved Contracts and UI foundations:

- a non-business Zod transport schema and inferred TypeScript type;
- deterministic OpenAPI 3.1.2 generation and drift detection;
- a generic, non-business SSE envelope with encode/parse smoke coverage;
- resolved primitive → semantic → component tokens for Light and Dark;
- two server-safe semantic React components (`Button` and `Surface`);
- minimal `/login` and `/app/today` use of `@xiangxu/ui`;
- lightweight token/static enforcement;
- the Stage 2 type-only boundary-checker debt and required fixtures.

No Task, Calendar, Inbox, Proposal, real Today workflow, authentication,
Session, User flow, AI/LLM, provider, connector, database, Drizzle,
PostgreSQL, Redis, BullMQ, migration, queue, full product page, or visual
reference recreation was implemented. Stage 5 and Gate 4.1 were not entered.

## 2. Source of Truth Read

The minimum Stage 4 source set was read before implementation:

- handoff `CURRENT_GATE.md` and root/package/app `AGENTS.md` files;
- Gate 3.8 Detailed System Design/API sections for package ownership,
  transport contracts, OpenAPI 3.1.2, SSE, tests, and UI boundaries;
- Gate 3.7 UI Design System sections and token tables;
- handoff `DESIGN_RULES.md`;
- Stage 0 `VERSIONS_LOCK.md` and `DEPENDENCY_REVIEW.md`;
- Stage 2 boundary matrix and evidence;
- Stage 3 runtime-shell evidence and its registered checker debt.

No Core Object, Revision, CAS, Proposal Risk, Scene Trust, or Domain semantic
rule was reinterpreted or changed.

## 3. Runtime and Handoff Integrity

| Evidence | Result |
|---|---|
| Node | `v24.19.0` |
| selected Node | `E:\sofeware\node-v24.19.0-win-x64\node.exe` |
| pnpm | `11.21.0` |
| selected pnpm | `E:\sofeware\node-v24.19.0-win-x64\pnpm.CMD` |
| pre-work handoff | `32 / 32 SHA-256 unchanged` |
| post-work handoff | `32 / 32 SHA-256 unchanged` |
| handoff manifest | `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/SHA256SUMS.txt` |
| handoff manifest SHA-256 | `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` |

The handoff directory remained read-only and was not used as an editing,
formatting, generation, or auto-fix target.

## 4. Dependency Decision and Lock Delta

Stage 0 approved the exact versions used by Stage 4. Zod 4's built-in
`z.toJSONSchema` satisfies the minimal OpenAPI need, so the separately approved
OpenAPI adapter was not installed.

| Owning package | Direct package | Exact version | License | Stage 4 decision |
|---|---|---:|---|---|
| `@xiangxu/contracts` | `zod` | `4.4.3` | MIT | transport validation and JSON Schema generation |
| `@xiangxu/ui` | `react` | `19.2.8` | MIT | server-safe semantic components |
| `@xiangxu/ui` | `@types/react` | `19.2.18` | MIT | build-time React declarations |

React and its types were already present in the Stage 3 graph; Zod is the only
new registry record.

| Audit | Stage 3 | Stage 4 | Result |
|---|---:|---:|---|
| SHA-512 integrity records | 187 | 188 | `+1`, exact Zod record |
| lockfile SHA-256 | — | `5b0449f935229b3c910a1871c53de413005a27975313cddd93fc945df2d1becd` | frozen |
| exotic sources | 0 | 0 | PASS |
| `requiresBuild: true` | 0 | 0 | PASS |
| `allowBuilds` | `{}` | `{}` | not expanded |
| pending builds | `[]` | `[]` | PASS |

`zod@4.4.3` has exact registry integrity
`sha512-ytEN...`, no dependencies, peers, optional dependencies, or
`requiresBuild` flag. Registry source metadata exposes authoring scripts, but
no consumer `preinstall`, `install`, `postinstall`, or `prepare` script. No
unknown lifecycle/build script was executed. The official registry remains
`https://registry.npmjs.org/` at project scope.

`pnpm install --frozen-lockfile` completed successfully after the final lock
update. Required Contracts, UI, and Web workspace links are present.

## 5. Stage 2 Checker Technical-Debt Resolution

`tools/boundary/check-boundaries.mjs` now separates two decisions:

1. manifest membership permits a package to exist in a workspace manifest;
2. the actual source syntax determines whether a type-only edge is respected.

The checker recognizes both canonical forms as type-only:

```ts
import type { Foo } from "@xiangxu/contracts";
import { type Foo } from "@xiangxu/contracts";
```

Specifier-only type re-exports are also recognized. Default, namespace, mixed,
and value imports remain runtime imports. A dependency's manifest section does
not automatically convert a runtime import into a type-only import.

Positive fixtures prove Domain and UI type-only forms with ordinary manifest
dependencies. Negative fixtures prove raw checker failure for:

- Domain runtime-importing Contracts;
- UI runtime-importing Contracts across a type-only edge;
- Domain importing Zod;
- Application importing React;
- UI importing Infrastructure.

The self-test result is positive fixture exit `0`, negative fixture raw exit
`1`, and 20 exact expected violation records. No artificial Domain → Contracts
import was added to production source.

## 6. Boundary Matrix Delta

The Stage 4 matrix activates only approved edges:

- Contracts → exact external `zod` at runtime;
- UI → exact external `react`, `react/*`, and React types;
- Web → UI at runtime;
- Domain → Contracts and UI → Contracts only as explicit type-only edges.

The real repository scan passed across 8 workspaces, 22 source inputs, and 2
manifest edges. Production scans confirmed: Domain has zero Contracts/Zod
imports, Application has zero React imports, and UI has zero DB, provider, or
Infrastructure imports.

## 7. Contracts Foundation

### Zod schema smoke

`contractMetadataSchema` is a strict, non-business transport schema for the
literal contract identifier, contract version, and OpenAPI version. Its smoke
proves:

- valid input parses successfully;
- invalid input is rejected;
- `z.infer` produces the expected `ContractMetadata` TypeScript type.

The schema is owned by Contracts and is not a Domain entity, aggregate,
database row, or application command.

### OpenAPI generation and determinism

`pnpm contracts:generate` writes
`artifacts/openapi/xiangxu-v1.json`. The document declares OpenAPI `3.1.2`,
JSON Schema 2020-12, and only the non-business contract/SSE schemas. `paths` is
intentionally empty; no fake business endpoint was invented.

Two consecutive generation runs produced the identical byte hash:

```text
run 1: cc6db61a0e48f3a7f0789ad5a40128f2dd92c885e409142ea7848c7d9b642e33
run 2: cc6db61a0e48f3a7f0789ad5a40128f2dd92c885e409142ea7848c7d9b642e33
```

The generated document has both `Generated` / `Do not hand-edit` markers and
contains no timestamp, random identifier, absolute path, or machine field.

### Drift detection

`pnpm contracts:check` generates an in-memory representation and byte-compares
it with the committed artifact. The drift self-test writes one mutated copy to
the operating-system temporary directory, invokes the raw checker, observes
exit `1`, and removes the temporary file. The normal artifact is never mutated
and the final normal check passes.

### SSE foundation

The generic envelope is restricted to `event`, `id`, `data`, and `version` and
uses a non-business `system.contract-metadata` fixture. The smoke validates the
envelope, serializes standard SSE `id`, `event`, and JSON `data` fields, parses
the encoded representation, and revalidates the round trip. No server,
EventSource client, Redis pub/sub, Worker push, or business event was added.

## 8. Token Resolution and Registry

The required decision table is in `docs/codex/TOKEN_RESOLUTION.md`. Every row
records Token, Gate 3.7 value, Gate 3.8 value, `DESIGN_RULES` value, resolved
value, winning source, and reason. Conflicting background, text, border, brand,
AI, success, danger, radius, and title values have one explicit winner under
the repository's SSOT priority; no parallel values were retained silently.

`packages/ui/src/tokens.css` is the single token source and implements:

```text
approved primitive values
  → Light/Dark semantic names
  → Button/Surface component tokens
```

It covers color, spacing, radius, typography, surface, border, and focus.
Light is the default theme; `[data-theme="dark"]` overrides the same semantic
names. Components consume semantic/component variables and do not select raw
hex, RGB, or spacing values.

## 9. Minimal Semantic UI and Web Integration

Only `Button` and `Surface` were created. Their APIs expose semantic props such
as `tone` and `size` and deliberately omit raw `style`, `className`, color, and
spacing decisions. They use no state, effect, browser API, hook, or `"use
client"` directive and remain server-safe.

Web imports the UI public entry, its centralized tokens, and both components.
`/login` retains the explicit statement that authentication is not implemented
and exposes only a disabled semantic button; it contains no form or submit
handler. `/app/today` remains a non-business placeholder. No dashboard or full
page redesign was performed.

The remaining Web CSS contains semantic variables only. The sole raw reset is
`margin: 0`, a browser-normalization declaration rather than a design token.
Web defines no second `--xx-*` registry.

## 10. Token Static Enforcement

`pnpm tokens:check` scans production `.css`, `.ts`, and `.tsx` files under
`apps/web/src` and `packages/ui/src`. It rejects:

- raw hex/RGB/HSL outside the approved primitive registry;
- unmanaged raw `px`, `rem`, or `em` in consuming/component layers;
- inline style props;
- Web-owned `--xx-*` token definitions;
- raw values leaking into the semantic/component portion of the registry.

It also proves that primitive, semantic, and component registry sections
exist. The final scan passed 11 files. This is intentionally a lightweight
static guard, not a claim of complete CSS parsing or design-governance proof.

## 11. Validation Record

| Check | Exit | Result |
|---|---:|---|
| exact Node/pnpm and executable paths | 0 | PASS |
| pre-work handoff verification | 0 | 32/32 unchanged |
| lockfile-only resolution with scripts disabled | 0 | PASS; no lifecycle execution |
| final frozen install | 0 | PASS in 605 ms |
| Contracts valid/invalid/type smoke | 0 | PASS |
| first deterministic generation | 0 | artifact hash `cc6db61…42e33` |
| second deterministic generation | 0 | identical bytes/hash |
| `pnpm contracts:check` | 0 | PASS |
| raw mutated drift check | 1 | expected negative evidence |
| `pnpm contracts:drift:test` | 0 | negative proof orchestrated and cleaned |
| SSE encode/parse/schema smoke | 0 | PASS |
| UI typecheck | 0 | PASS |
| UI build | 0 | JS, declarations, and CSS emitted |
| `pnpm tokens:check` | 0 | 11 production files PASS |
| `pnpm boundary` | 0 | 8 workspaces, 22 source inputs, 2 manifest edges |
| raw negative boundary checker | 1 | 20 required violations |
| `pnpm boundary:test` | 0 | positive 0 / negative 1; exact records PASS |
| Web production build | 0 | `/`, `/login`, `/app/today` generated |
| Web production HTTP smoke | 0 | `/login` 200; `/app/today` 200 |
| Worker existing smoke | 0 | health 200, fake job, graceful shutdown |
| `pnpm lint` | 0 | PASS; no lint rule weakened |
| `pnpm typecheck` | 0 | 8/8 workspace graph PASS |
| `pnpm build` | 0 | complete workspace graph PASS |
| `pnpm verify` | 0 | complete Stage 4 chain PASS in 21 s |
| post-work handoff verification | 0 | 32/32 unchanged |

The unified verification chain includes lint, strict typecheck, real boundary
checks, boundary negative self-test, Contracts drift check, token/static check,
the Stage 3 Web and Worker smokes, and the full build graph.

## 12. Findings Corrected During Verification

No false PASS was claimed for intermediate failures:

- Contracts initially referenced `console` without Node/DOM types; the unused
  log was removed instead of broadening this pure package's environment.
- TypeScript 6 initially required a declaration for the CSS side-effect import;
  a narrow `styles.d.ts` declaration was added with strict settings unchanged.
- Turbopack could not resolve a source `.js` specifier to `.tsx`; the UI package
  now exposes source types and built runtime artifacts through conditional
  exports, and the dependency-aware Web build builds UI first.
- root lint initially lacked Node globals for package build scripts; the
  existing script-file override was scoped to those scripts without disabling
  or weakening a rule.

All affected commands were repeated and passed.

## 13. Acceptance Criteria

| # | Criterion | Result |
|---:|---|---|
| 1–2 | exact runtime; handoff pre-hash | PASS |
| 3–6 | checker debt, both type syntaxes, runtime rejection | PASS |
| 7–9 | Contracts/Domain separation, no Domain Zod, approved dependencies | PASS |
| 10–11 | Zod smoke; no business schema | PASS |
| 12–15 | generation, determinism, drift detection, raw exit 1 | PASS |
| 16–17 | SSE transport foundation; no business SSE workflow | PASS |
| 18–19 | Token Resolution table and explicit conflict decisions | PASS |
| 20–22 | Light, Dark, and semantic token layers | PASS |
| 23–24 | minimal semantic components; no UI DB/provider dependency | PASS |
| 25–27 | Web integration; no auth; no Today business workflow | PASS |
| 28–29 | no consuming raw hex; no parallel registry | PASS |
| 30 | all Stage 4 boundary negative fixtures | PASS |
| 31–34 | lint, typecheck, boundary, boundary self-test | PASS |
| 35–37 | generation, drift check, token/static check | PASS |
| 38–39 | Web build; Worker validation retained | PASS |
| 40–41 | frozen install; unified verify | PASS |
| 42 | handoff post-hash | PASS — 32/32 unchanged |
| 43–44 | Stage 5 and Gate 4.1 non-entry | PASS |

## 14. Known Limits and Deferred Work

- The token checker is a deliberately bounded lexical/static guard, not a CSS
  AST validator. Its precise scan scope and assertions are documented above.
- OpenAPI `paths` remains empty intentionally; business endpoints belong to a
  later explicitly approved stage.
- No browser visual-evidence pass was added: Stage 4 requires foundation and
  build/runtime proof, forbids page/reference reconstruction, and later Gate
  stages own broader browser evidence.
- PostgreSQL, Drizzle, Redis, BullMQ, migration, and queue work is deferred to
  Stage 5 and was not started.

## 15. Final Status

```text
Stage 4 PASS — Stage 5 not started.
Gate 4.1 not started.
```
