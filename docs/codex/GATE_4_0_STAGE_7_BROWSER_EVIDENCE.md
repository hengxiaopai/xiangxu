# XIANGXU Gate 4.0 / Stage 7 Browser & Visual Evidence

> Stage: Gate 4.0 / Stage 7 — Browser & Visual Evidence
> Audited at: 2026-08-12
> Status: **STAGE 7 PASS**
> Stage 8: not started
> Gate 4.1: not started

## 1. Result and Scope

Stage 7 proves only that the existing Stage 3 Web Runtime Shell and Stage 4 UI
Foundation render correctly in production-browser conditions. It adds no
authentication, user/session model, business data, workflow, provider,
connector, dashboard, database-backed page, or queue-backed page.

The final evidence contains eight stable Light/Dark desktop/mobile PNGs, a
deterministic SHA-256 manifest, real keyboard activation evidence, and local
full regression. No production Web or UI source change remains.

```text
Stage 7 PASS — Stage 8 not started.
Gate 4.1 not started.
```

## 2. Baseline and Source of Truth

| Check | Result |
|---|---|
| Stage 6 | PASS |
| branch | `main` |
| local HEAD | `d568729f6f314fa00ff69266fe2932a680a041ac` |
| local `origin/main` | `d568729f6f314fa00ff69266fe2932a680a041ac` |
| Stage 7 approved checkpoint CI | run `31553374868`, recorded as success in the Stage 7 instruction |
| Stage 6 corrective hosted evidence retained by repository | run `31553121149`, exact commit `964a965dfd6b6161c3a55f30fc557b255a68fea1`, `ubuntu-24.04` |
| initial worktree | clean |

The minimum Stage 7 SSOT was read: repository and nested `AGENTS.md` files,
Stage 3/4/6 evidence, Stage 0 dependency/version review, Gate 3.7 responsive and
accessibility sections, Gate 3.8 Web/UI/browser-evidence sections, and relevant
`DESIGN_RULES.md` sections. Domain, persistence, queue, and the full PRD were not
reinterpreted.

## 3. Runtime, Handoff, and Supply Chain

| Check | Result |
|---|---|
| Node | `v24.19.0` |
| pnpm | `11.21.0` |
| selected Node | `E:\sofeware\node-v24.19.0-win-x64\node.exe` |
| selected pnpm | `E:\sofeware\node-v24.19.0-win-x64\pnpm.CMD` |
| handoff pre-hash | `32 / 32 SHA-256 unchanged` |
| handoff manifest SHA-256 | `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` |
| handoff post-hash | `32 / 32 SHA-256 unchanged` |
| browser project dependency | none |
| `pnpm-lock.yaml` SHA-256 | `46f3adcb852a98c2406fbc3b944e1bfb3c13c880abb14a7913f39eed6d7f5d79`, unchanged |

Stage 0 did not approve Playwright, Puppeteer, Selenium, or WebDriver as a
repository dependency, so none was installed. Screenshot and DOM evidence used
the OpenAI bundled Codex In-app Browser capability version `26.803.81509`.
Keyboard Recovery used the already-connected OpenAI bundled Chrome capability
version `26.803.81509` with locally installed Google Chrome `137.0.7151.69`;
the binary has a valid Google LLC Authenticode signature. These capabilities do
not alter the product dependency graph and execute no repository lifecycle
script.

One targeted `contracts:check` attempt was rejected before contract work when
its nested `pnpm` inherited the system Node 22/pnpm 9 PATH. The engine gate
failed closed; no install, generation, build, or lockfile mutation occurred.
The process-local PATH was then pinned to the approved Node directory, the
check passed, and the final complete `pnpm verify` ran under Node 24.19.0 and
pnpm 11.21.0.

## 4. Production Runtime and Routes

All browser cases ran against `next start`, never `next dev`, bound only to
`127.0.0.1:4327`.

| Assertion | Result |
|---|---|
| production Web build | PASS |
| `/` | HTTP 307, `Location: /login` |
| `/` with redirect follow | HTTP 200, final `/login`, one redirect |
| `/login` | HTTP 200 |
| `/app/today` | HTTP 200 |
| redirect loop | none |

Dark evidence used a controlled production build with only the root
`data-theme` set to `dark`. The source was then restored to the default `light`
value and rebuilt. `apps/web/src/app/layout.tsx` has no final diff.

## 5. Viewport, Theme, and Screenshot Matrix

Gate 3.7 freezes representative widths but not heights, so the approved Stage 7
fallback matrix was used: desktop `1440 × 900`, mobile `390 × 844`.

| File | Route | Viewport | Theme | SHA-256 |
|---|---|---:|---|---|
| `login-desktop-light.png` | `/login` | 1440×900 | Light | `fac9704efe424ae765ca334dd3b08722572c8c180403ccc52558e9d6fde6ef8c` |
| `login-desktop-dark.png` | `/login` | 1440×900 | Dark | `0a286477765b4ff30bf0cc6c50ee75471d54f508b207a3078d967c16512046e1` |
| `login-mobile-light.png` | `/login` | 390×844 | Light | `547bfc29d397358e719b0ee01d3bc249fc6c95e43a47890615d0dc85e4440ccc` |
| `login-mobile-dark.png` | `/login` | 390×844 | Dark | `413a87d0d150a352c674a973914f12d1b10fa08ec39596aa7c63fc2e7b50f51e` |
| `today-desktop-light.png` | `/app/today` | 1440×900 | Light | `fa455298f6d4fad7215ead4e5ada686591864771fb3b31aa4e9a444c2a367a65` |
| `today-desktop-dark.png` | `/app/today` | 1440×900 | Dark | `7d5daf6639a01bf7abefa5cb2da09ee9cd060c0694916dbb2d902e1bebd2e658` |
| `today-mobile-light.png` | `/app/today` | 390×844 | Light | `31781ee8cfd3a717bc6ba00682ec7b4bbb1b08c5e16d5b46af353f458f6efbaf` |
| `today-mobile-dark.png` | `/app/today` | 390×844 | Dark | `10f57c1bf77f3c655b853982c57eae524446828687d59cb8f7b899f6fc9fb322` |

Every PNG is a page-only screenshot. All eight were inspected at original
resolution and contain only XIANGXU placeholder-shell content. No account,
real user data, secret, credential, local absolute path, Handoff reference
image, desktop, bookmark, avatar, or unrelated application is visible.

The deterministic manifest is
`artifacts/browser/stage7/manifest.json`. It has no timestamp, username,
absolute path, machine name, or random identifier. PNG hashes assert artifact
integrity only; they are not a cross-OS pixel-perfect baseline.

## 6. Runtime, Geometry, Semantics, and Tokens

Across all eight cases:

```text
console errors = 0
page errors = 0
unexpected failed requests = 0
external business requests = 0
horizontal overflow = false
unintended clipped elements = 0
duplicate IDs = 0
```

The Chrome user profile contained an unrelated Immersive Translate extension
that emitted extension-origin console errors during one rejected screenshot
attempt. That screenshot was not used. The missing dark-mobile screenshot was
recaptured in the isolated in-app browser, whose page log was empty; the final
manifest does not suppress or downgrade any XIANGXU error.

DOM checks found `lang="zh-CN"`, one `main` landmark on both routes, a logical
heading hierarchy, a `nav` landmark with two native anchors on `/app/today`,
and a native disabled button on `/login`. No input, textarea, select, form, or
credential control exists, so there is no applicable missing label.

Representative computed token proof:

| Token/element | Light | Dark |
|---|---|---|
| canvas | `#fafaf7` | `#101615` |
| surface | `#fff` | `#161d1b` |
| primary text | `#18201e` | `#eef3f0` |
| focus | `#0b493d` | `#cbede9` |
| focus width | `2px` | `2px` |

The same semantic token names resolve to theme-specific values. No second token
registry or consuming-layer raw-color workaround was added.

## 7. Trusted Keyboard Recovery

### First blocked attempt retained

The first Stage 7 attempt correctly remained BLOCKED because trusted Enter
activation could not be proven safely. The in-app browser proved Tab and focus
styles but its Enter injection did not activate the anchor. Computer Use then
failed closed because it could not confirm the Windows browser URL with enough
confidence. No safety check was disabled or bypassed.

During Recovery, the preferred standalone Chrome/CDP launch was also rejected
by the local command safety policy before any Chrome process or debugging
endpoint was created. That route was abandoned rather than bypassed.

### Successful Recovery method

The existing approved Chrome browser automation capability created and owned a
fresh local tab at `/app/today`. A verified non-interactive blank page point was
used only to place focus in the document; no link was clicked. Browser-level
CUA key input then produced this chain:

```text
initial active element: BODY
Tab 1: A / "Today shell" / href "/app/today"
Tab 2: A / "Login shell" / href "/login"
Enter: real browser-level keypress
default anchor activation
final URL: http://127.0.0.1:4327/login
final pathname: /login
HTTP: 200
rendered heading: 登录
```

Both focused links resolved a visible `2px solid rgb(11, 73, 61)` outline.
Shift+Tab from `Login shell` returned focus to `Today shell`. The browser
inspection scope is read-only, so no temporary `keydown.isTrusted` observer
could be installed; the Recovery instruction marks that observer as optional.
The acceptance proof instead relies on the approved browser-level input command
and the resulting native default navigation, not click, `focus()`,
`dispatchEvent`, `KeyboardEvent`, scripted `goto`, or synthetic DOM activation.

On `/login`, Tab left focus on `BODY`, skipped the disabled button, and Enter
left the route unchanged. Page-asset inventory gained no resource and contained
only `http://127.0.0.1:4327` assets. The disabled button remained `disabled ==
true`; no submit or authentication request occurred.

The deterministic keyboard record is
`artifacts/browser/stage7/keyboard-enter.json`.

## 8. Scope, Storage, and Network Proof

`/login` contains no form, credential input, authentication request, submit
workflow, or enabled login action. `/app/today` remains the semantic placeholder
and contains no task, calendar, inbox, proposal, database data, or business
workflow.

Static source scans returned zero references in Web/UI source for:

```text
localStorage
sessionStorage
IndexedDB
document.cookie
fetch
XMLHttpRequest
WebSocket
EventSource
external HTTP URLs
auth/OAuth/session endpoints
```

The privacy-isolated in-app browser does not expose storage APIs for runtime
enumeration. The zero source references, server-rendered placeholder-only
implementation, and local-only observed asset inventory together prove that
Stage 7 did not introduce business browser state or external provider calls.

## 9. Repository Tooling and Corrective Changes

No product defect required a production corrective change. Stage 7 adds only:

```text
pnpm browser:check
pnpm browser:evidence
tools/browser/check-keyboard-evidence.mjs
tools/browser/check-evidence.mjs
artifacts/browser/stage7/*
this evidence document
repository stage-status updates
```

The checkers use Node built-ins only. They validate the recorded real-keyboard
chain, required eight filenames, SHA-256 values, HTTP/error/overflow fields,
and manifest completeness. No browser dependency, lifecycle approval,
production edge, or lockfile entry was added.

## 10. Regression

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS — already up to date |
| `pnpm browser:check` | PASS |
| `pnpm browser:evidence` | PASS |
| `pnpm tokens:check` | PASS — 11 files |
| `pnpm boundary` | PASS — 8 workspaces, 34 source files, 2 manifest edges |
| `pnpm contracts:check` | PASS — OpenAPI byte-stable |
| `pnpm verify` | PASS — exit 0 |
| Web production build/smoke | PASS |
| Worker build/smoke | PASS |
| PostgreSQL/Redis/BullMQ verification | PASS |

The final `pnpm verify` ran under Node `v24.19.0` and pnpm `11.21.0`. Its
infrastructure proof recorded PostgreSQL `18.4`, Redis `8.2.8`, BullMQ fake job
completion, deterministic migration state, and complete container/network/
volume cleanup.

## 11. Cleanup, Git, and Publication

```text
Stage 7 production server processes: 0
port 4327 listeners: 0
standalone Stage 7 Chrome/CDP processes: 0 (none created)
Stage 7 Chrome and in-app-browser tabs: finalized
XIANGXU Docker containers: 0
XIANGXU Docker volumes: 0
XIANGXU Docker networks: 0
Docker Desktop: returned to stopped state
production Web/UI source diff: 0
pnpm-lock.yaml change: 0
```

Stage 7 commit and push were not authorized and were not performed. Handoff
remains local-only, read-only, and unpublished.

## 12. Acceptance Closure

| Criteria | Result |
|---|---|
| 1–6 baseline/runtime/handoff pre-hash | PASS |
| 7–11 browser supply chain | PASS |
| 12–17 production runtime/routes | PASS |
| 18–28 eight-state evidence/manifest/hashes | PASS |
| 29–37 browser quality/tokens | PASS |
| 38–46 semantic keyboard/accessibility smoke | PASS |
| 47–51 no-auth/no-business/no-external-state scope | PASS |
| 52–63 cleanup/frozen install/full regression/handoff post-hash | PASS |
| 64 Stage 8 not started | PASS |
| 65 Gate 4.1 not started | PASS |

This is a Gate 4.0 browser/keyboard smoke record, not a full WCAG certification
or a cross-platform visual-regression framework.

```text
Stage 7 PASS — Stage 8 not started.
Gate 4.1 not started.
```
