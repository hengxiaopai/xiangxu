# XIANGXU — Gate 4.1 Stage 8 Production Browser Evidence

## Final disposition

```text
Gate 4.1 Stage 8 PASS —
Stage 9 not started.
Gate 4.2 not started.
```

Stage 8 was executed only after the formal Stage 7 PASS and explicit human
authorization. It verified the Stage 1–7 Daily Loop in the approved bundled
Chromium and made only bounded browser/test corrections. It added no public
API, DTO, Application command/query, table, migration, Core Object, product
surface, provider, Connector, external dependency, or browser channel.

No commit, staging, push, tag, release, or publication was performed.

## Authoritative baseline and integrity

| Item | Stage 7 baseline | Stage 8 final | Result |
| --- | --- | --- | --- |
| branch | `main` | `main` | unchanged |
| HEAD | `a3183a026fea893b66c7b72dd65ce0f15d7fa572` | same | PASS |
| `pnpm-lock.yaml` SHA-256 | `362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e` | same | PASS |
| OpenAPI SHA-256 | `87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f` | same | PASS |
| migration count | 6 | 6 | PASS; no `0006` |
| Handoff manifest SHA-256 | `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` | same | PASS |
| Handoff pre/post | 32 / 32 | 32 / 32 | PASS; read only |

Frozen migration hashes remained byte-identical:

```text
0000_motionless_bloodaxe.sql 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001_noisy_ravenous.sql      cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0002_spotty_mindworm.sql     524ebabff73582a52a8ff32b1be35b0f78dd0d5a9918ced5051ac54981002bfc
0003_mean_argent.sql         fefa9806107faf7b057479f93ce5176e0e3a6ddc8ddec97dad24e4a99bddc1f5
0004_normal_sabra.sql        e89081fbcdc578649d3c7a0e688d49e5a93f40ce9a58669c319902cd1267a6f3
0005_empty_whirlwind.sql     c34dfe74955a42c9011f7f7fbd391c99a66349effc9f2eafae5ba4d428f38658
```

Stage 8 dependency, migration, lockfile, and OpenAPI deltas are all zero.
`pnpm install --frozen-lockfile` reported all nine workspace projects already
up to date. `db:generate` reported `No schema changes, nothing to migrate`.

## Browser provenance and launch

| Item | Evidence |
| --- | --- |
| Node | exact `v24.19.0` |
| pnpm | exact `11.21.0` |
| Playwright | exact `1.62.0` |
| browser project | `chromium` only; no channel override |
| Chromium revision | Playwright Chromium `v1234` |
| actual browser | Chrome for Testing `151.0.7922.34` |
| executable | `C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe` |
| cache destination | `C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1234` |
| Chromium source | `https://cdn.playwright.dev/builds/cft/151.0.7922.34/win64/chrome-win64.zip` |
| host overrides | `PLAYWRIGHT_DOWNLOAD_HOST` and `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` unset |
| launch smoke | headless launch, in-memory page load, title/text read, clean close PASS |

The dry run also resolved Playwright-owned FFmpeg, Headless Shell, and Winldd
artifacts through `cdn.playwright.dev` and the documented Microsoft Playwright
fallback. No Firefox, WebKit, Google Chrome channel, Edge channel, or third-party
mirror was installed or used. `browser:verify` fails with a clear instruction
when the approved executable is absent; it never downloads a browser silently.

The OpenAI Browser/Chrome skills were not accepted as Stage 8 PASS evidence:
the explicit authorization required repository Playwright with bundled
Chromium, so all formal evidence comes from that route.

## Browser surface and action inventory

The real bounded product surface is:

```text
/login
/app/today
/app/review
```

USER-DRIVEN in real Chromium:

- establish and end the approved development session;
- navigate Today/Review;
- select existing Tasks, enter capacity, and commit an immutable Plan version;
- submit Quick Capture online and offline;
- observe asynchronous Proposal-ready state and explicitly Apply it;
- create a Review Snapshot where the frozen version-1 UI condition permits it;
- use back/forward, keyboard, reconnecting, error, empty, and reduced-motion states.

TEST-SETUP-ONLY:

- create canonical Task and TimeBlock fixtures through real server APIs;
- create independent Actor/session fixtures through hash-only session
  persistence;
- prepare deterministic visual Plan/Review state;
- inspect canonical PostgreSQL counts and real IndexedDB records.

NOT EXPOSED and not claimed:

- Task or TimeBlock creation UI;
- ExecutionRecord creation;
- historical baseline selection after a multi-version plan;
- user-facing theme toggle or mobile drawer;
- any additional early-IA route, AI provider, Connector, Knowledge, or Scene
  Pack surface.

## Production runtime and deterministic environment

Every formal browser run used:

```text
PostgreSQL 18.4
Redis 8.2.8
BullMQ
Outbox Dispatcher
real ProposalGenerationProcessor / Application handlers
Next 16.3.0 production build
next start --hostname 127.0.0.1 --port 43117
Playwright 1.62.0 bundled Chromium
```

The runner checks the exact Node version and prebuilt Web/Worker artifacts,
starts an isolated Docker Compose project on PostgreSQL `55432` and Redis
`56379`, applies the six migrations twice, starts the real dispatcher/worker,
and then starts `next start`. `next dev`, `0.0.0.0`, mocked `/api/v1/*`
responses, polling substitution, external assets, and external AI/network calls
are absent.

The browser environment is fixed to `zh-CN`, `Asia/Shanghai`, deterministic
`2026-08-13T03:00:00.000Z`, stable UUID/text fixtures, explicit viewport/theme,
blocked service workers, and no retry. Animations are disabled/settled for
screenshots and fonts are awaited.

## Functional E2E matrix

All nine canonical Playwright cases passed with one Chromium worker:

1. Anonymous, valid, revoked, logout, and browser-back authority fail closed.
2. Keyboard-driven Task/TimeBlock projection → Plan → Quick Capture → real
   Dispatcher/Worker Proposal → explicit Apply → Review completes.
3. A real `next start` restart plus client-network fault injection proves SSE
   reconnection, `Last-Event-ID`, and replay of a committed missed event.
4. Two independent browser contexts prove Actor isolation across UI, mutation,
   SSE, TanStack, and IndexedDB.
5. Real IndexedDB survives reload, synchronizes exactly once, and isolates Auth
   Epochs.
6. Same-Actor multi-tab receives targeted SSE/TanStack refresh without reload.
7. The 22-shot responsive Light/Dark matrix matches reviewed baselines.
8. Keyboard focus, roles/names, heading order, and focus-visible pass.
9. Reduced-motion preserves Login, Today, Capture, Proposal, and Review state.

Fixture preparation used the real production server and database. Playwright
route interception was used only for explicit client network-loss fault
injection on Capture or SSE; it never fabricated an API, worker, Proposal,
Review, or SSE business result.

## Authentication, Actor isolation, and browser security

- Anonymous reads/mutations return the frozen unauthenticated behavior.
- A valid session renders Today; server-side revocation removes authority.
- Logout revokes/removes the cookie; browser Back cannot restore mutation
  authority and reload reaches the safe state.
- Chromium observed the session cookie as `HttpOnly`, `SameSite=Lax`, `Path=/`,
  with an expiry; `document.cookie` cannot read it.
- Context B cannot see or complete Context A's Task, receive A's SSE data, or
  read A's offline records.
- No screenshot, console assertion, trace, or Evidence stores a raw session
  token, session hash, cookie value, database URL, Redis credential, or raw
  user credential.

## SSE and TanStack proof

The browser received real durable `object.changed` and `proposal.ready`
envelopes with nondecreasing numeric event IDs. It never received or rendered
the internal `capture.triage.requested` dispatch topic.

During the reconnect case the real production Next process was stopped and
restarted. A Task committed while the EventSource was unavailable appeared
after reconnect, and the subsequent stream request carried a numeric
`Last-Event-ID`. The only allowlisted console/network failure was the exact
intentional connection interruption.

The multi-tab case proved targeted invalidation: a Task mutation in Tab A made
Tab B issue an additional Task read and render the Task, while unrelated
Proposal reads did not increase. Static checking also found zero unfiltered
`invalidateQueries()` calls.

## Real IndexedDB and Auth Epoch proof

The P0 IndexedDB scenario used Chromium's native `globalThis.indexedDB`:

```text
online authenticated Actor A
→ browser offline
→ submit "Stage 8 IndexedDB reload fixture"
→ one pending IndexedDB command
→ reload
→ same local UUIDv7
→ same Idempotency-Key
→ same opaque Auth Epoch
→ restore network
→ done
```

Before reload the record contained a validated Capture payload, `pending`
state, a stable local UUIDv7 equal to its Idempotency-Key, and a UUID-shaped
opaque Auth Epoch. After reload all three identifiers were unchanged. After
sync the state was `done` and PostgreSQL contained exactly:

```text
Capture       1
RawPayload    1
ChangeRecord  1
Outbox rows   2
Idempotency   1
```

Actor A then created a second offline pending Capture, logged out, and Actor B
logged in. The old text was absent from B's UI, the old Capture count remained
zero, and the old record froze as `conflict`; it was never replayed as B.

The bounded product correction was to retain one versioned opaque Auth Epoch
in `sessionStorage` for the life of a browser session and rotate it only when a
new client session starts or logout occurs. No authority, identity, token, or
cookie value is stored there; the server remains the authority and the token
remains HttpOnly.

## Responsive, Light/Dark, and visual review

The reviewed matrix contains 22 responsive screenshots plus 3 focus
screenshots. Responsive coverage is:

| Route | Viewports | Themes |
| --- | --- | --- |
| `/login` | 1440×900, 390×844 | Light, Dark |
| `/app/today` | 1440×900, 1280×800, 1024×768, 768×1024, 390×844 | Light, Dark |
| `/app/review` | 1440×900, 1024×768, 768×1024, 390×844 | Light, Dark |

Automated geometry asserted exact viewport width, no horizontal page overflow,
and no visible interactive control outside the viewport. Today and Review use
full-page captures so Fact, Proposal, Snapshot, and all actions are reviewed.

All 25 final PNGs were manually inspected at the appropriate original/high
resolution for overflow, clipping, overlap, off-screen controls, truncation,
fixed/sticky collision, unreadable contrast, unexpected gaps, touch-target
compression, and broken hierarchy. No defect remains. Fact, Proposal, and
Snapshot are distinguished by labels, hierarchy, borders/surfaces, and content
semantics—not color alone.

The visual corrections reused frozen tokens only: dark/light semantic text and
status mappings were brought above the WCAG-oriented threshold, button native
appearance was normalized, and Today/Review baselines were made full-page. No
hex value, one-off shadow/radius/spacing token, or new design token was added.

### Screenshot inventory and SHA-256

All files are under
`artifacts/browser/gate-4.1-stage-8/visual-baselines/chromium/`.
Full-page PNG height may exceed its viewport height.

| File | PNG dimensions | SHA-256 |
| --- | ---: | --- |
| `focus-login-button-mobile-light.png` | 390×844 | `dd65a95f62ab794fe561686d0efe19f9cb7b8c9ceab57564a24872a8cc917469` |
| `focus-navigation-mobile-light.png` | 390×844 | `a640f32a559a15a9e89d454d17b211ed094b82e4ed06c1fffdf8075e92ed050c` |
| `focus-today-checkbox-mobile-light.png` | 390×844 | `bc51b45dc36dd22d3551216cd62723ca505993bd7087c8744ff34410dff74681` |
| `responsive-login-1440x900-dark.png` | 1440×900 | `2c6e9ace68cadecc4f0c208c2cd06d164d66f81dae6dd154bbd6c5d71994054b` |
| `responsive-login-1440x900-light.png` | 1440×900 | `42ab5fd56d1b631a79dffe2a2312f8e9b5c0c228946e97f0f8a4f4676998a28d` |
| `responsive-login-390x844-dark.png` | 390×844 | `9025e1dd14f7ecfc7c8a5b470b9844809c479575a1f5aa4b48e52aef21ade096` |
| `responsive-login-390x844-light.png` | 390×844 | `177e49352b7ebb1539b7d1a7609e13bc6f69c1b1124911d3fa62852ca6ccce9b` |
| `responsive-review-1024x768-dark.png` | 1024×1294 | `c835fc46379abfd9bb2469ab75c4f9eeac2431be020c674e70a6ef7b882023a4` |
| `responsive-review-1024x768-light.png` | 1024×1294 | `f9474b85c5d02e70a404db3b392bc10094fe918592f2dfdfef1e4b4d65146cd8` |
| `responsive-review-1440x900-dark.png` | 1440×1091 | `5e7e6f02f25ee086bd739aba84a3172643b2a614bf437f45b830ff977f7c0373` |
| `responsive-review-1440x900-light.png` | 1440×1091 | `acbe8722682287de63c884bac9d1ab2600d243cb0a574dfcf12e34f09a4a5677` |
| `responsive-review-390x844-dark.png` | 390×1556 | `c4b210bd6edf41fd594f2a2b80fb612903731cc76df371e69f2970fb9b147e41` |
| `responsive-review-390x844-light.png` | 390×1556 | `eb92d7f614b4dbcf3f10dda222e1b01723c695001ae712d306c490d39d0a6611` |
| `responsive-review-768x1024-dark.png` | 768×1534 | `42f2ac930175860ed0d3ee9f342ba3e949e1dff218f8edc52cfaae604023c22b` |
| `responsive-review-768x1024-light.png` | 768×1534 | `766201dc39aab9a7c8d4d3cd04e98a8b526d82ffdfd6f2e35ee1fdecd190d229` |
| `responsive-today-1024x768-dark.png` | 1024×1897 | `6e6e977f4f88a8662ca444857a4bc74e02416a28e3dac70a48a561e437b7b9bd` |
| `responsive-today-1024x768-light.png` | 1024×1897 | `069954f170845df91ad2beb2b79f96025d8ab9b45fa788501eb99bac3ed9c5fc` |
| `responsive-today-1280x800-dark.png` | 1280×1694 | `222fd96ce9ff702ee12634e73be1de8d1f704fba1ad566927276709c6a7c94d4` |
| `responsive-today-1280x800-light.png` | 1280×1694 | `0806249c611af58247ccb19970e64fe61177d3ef6b74cf856eb477498ea9a4c5` |
| `responsive-today-1440x900-dark.png` | 1440×1694 | `802ba355c8867f2b1c2b67c65c52a8377dc3a0ccd379b5b520289bfcb7228f0b` |
| `responsive-today-1440x900-light.png` | 1440×1694 | `9e4c773935c5327058d64ac06e2f0073e447a01b8cb7ff83c43c6d8c1b4e0df6` |
| `responsive-today-390x844-dark.png` | 390×2121 | `72965fa345345989b58f81f16a0f0886e82f4f90f1e9cc9a655521ee7f37d410` |
| `responsive-today-390x844-light.png` | 390×2121 | `67ae8898706dd683c0cc01729846216dca871ec9de0fa3bd5accb5c6e7314dae` |
| `responsive-today-768x1024-dark.png` | 768×2099 | `122808acfd562cc316411f3054e4731414c14965f2330b448753e3ee8900ea26` |
| `responsive-today-768x1024-light.png` | 768×2099 | `7bf16f234ce85386afe53ecf1c80654e71ae8e4f10db60df7c17245c474292a5` |

## Visual regression Run A / Run B

```text
Run A — reviewed baseline establishment:
  9 / 9 Playwright tests PASS
  49.3 seconds test time
  25 PNGs written after all bounded fixes

clean server/browser/database state

Run B — independent baseline comparison:
  9 / 9 Playwright tests PASS
  50.8 seconds test time
  maxDiffPixels = 0
  no baseline update

post-pnpm-verify final comparison:
  9 / 9 Playwright tests PASS
  45.2 seconds test time
  no baseline update
```

Diagnostic runs before Run A found and corrected the Auth Epoch persistence,
dark semantic contrast, native button appearance, and full-page framing issues.
One diagnostic Chromium target crash did not recur in its single isolated retry
or any formal run. A suspected 1024px dark button defect during manual review
was confirmed to be a resized preview artifact; the original PNG is complete.
No regression was accepted by updating Run B.

## Keyboard, semantics, contrast, and reduced motion

Real keyboard interaction covers Tab, Shift+Tab, Enter, Space, and ArrowUp for
the components whose native semantics require them. Login, navigation, Task
selection, capacity, plan submission, Quick Capture, Proposal Apply, and Review
navigation/actions are reachable without a mouse. There is no temporary drawer
or dialog in the frozen Stage 7 surface, so Escape/return-focus behavior is not
applicable and was not invented.

Three original-resolution focus screenshots plus computed outline/box-shadow
assertions prove visible focus for Login, navigation, and Today selection.
Role/name assertions cover navigation, main, buttons, links, checkboxes,
spinbutton, textbox, status/error states, and ordered heading levels.

The bounded static checker scanned 14 production TSX files, one direct native
button, and three form controls. It rejects positive `tabIndex`, noninteractive
click handlers without semantics, missing image alt semantics, obvious unnamed
buttons/forms, landmark misuse, and unfiltered global invalidation. It is
recorded as a bounded negative scan, not a complete WCAG certification.

Computed WCAG-oriented contrast checks cover body, secondary/ontology text,
primary actions, connection/error states, brand, and intelligence surfaces in
Light/Dark and degraded unauthenticated states. Every measured simple opaque
text/background pair is at least 4.5:1; complex visual relationships were also
manually reviewed.

A dedicated `prefers-reduced-motion: reduce` context proves Login, Today,
Quick Capture, Proposal-ready, and Review remain visible and operable, with no
transition blocking, focus loss, hidden essential state, or spinner-only state.

## Console, page-error, and degraded-state gate

Core pages collect `console.error`, `pageerror`, unhandled rejection, failed
same-origin requests, hydration failures, and React warnings. Unexpected count
is zero across all formal cases. Precise allowlists exist only for intentional
401/404 states and explicit Capture/SSE connection-fault injection.

Browser coverage includes unauthenticated, empty Today, missing Review,
AI-unavailable/not-generated, SSE reconnecting, offline pending, offline sync,
Auth Epoch conflict, and the frozen zero-actual Review state. Errors are visible
in product state and are not console-only false successes.

## Bounded corrections and regression defect

Stage 8 production corrections are limited to:

- browser-stable Auth Epoch persistence/rotation without storing authority;
- existing-token contrast mappings in Light/Dark;
- native button appearance normalization;
- full-page visual evidence framing.

The unified infrastructure regression exposed a separate test-only time-boundary
bug: the lease test hard-coded `2026-08-13T08:00:00Z` while the Outbox
`available_at` used database current time. Once UTC passed 08:00, the first
claim was correctly unavailable. The test now derives its claim clock from its
own Outbox row plus 1 ms; production lease SQL and the 1000 ms semantic checks
are unchanged. The repaired infra smoke and final `pnpm verify` both passed
52 / 52 database tests.

Two early root-script attempts failed closed before their intended work because
nested scripts resolved the machine pnpm 9.0.2. Final canonical commands used a
temporary PATH-first shim that forwarded only to approved pnpm 11.21.0 under
Node 24.19.0. The shim was deleted after verification. One opaque `pnpm verify`
attempt was terminated after the repository's no-output threshold; its cleanup
audit found no process, listener, container, volume, or network residue. The
subsequent observable component checks and final canonical run passed.

## Final verification

```text
pnpm install --frozen-lockfile: PASS, 9 projects, already up to date
pnpm ci:check: PASS, real 0 / negative 1 / 33 expected violations
pnpm lint: PASS
pnpm typecheck: PASS, 8 / 8 workspaces
pnpm boundary: PASS, 8 workspaces / 114 source files / 7 edges
pnpm boundary:test: PASS, positive 0 / negative 1 / 63 violations
pnpm contracts:check: PASS, byte-stable
pnpm tokens:check: PASS, 45 files
pnpm test: PASS, 10 / 10 workspace tasks
pnpm build: PASS, 4 / 4 build tasks and Next production build

clean rebuild cycle 1:
  PostgreSQL 18.4, migrations 6, DB integration 52 / 52, sentinel 0
clean rebuild cycle 2:
  PostgreSQL 18.4, migrations 6, DB integration 52 / 52, sentinel 0

pnpm infra:smoke after time-fixture correction:
  PostgreSQL 18.4 / Redis 8.2.8 / BullMQ / production HTTP PASS
  DB integration 52 / 52

pnpm verify: PASS
pnpm browser:verify: PASS, 9 / 9, Chromium only, no baseline update
```

No existing strict compiler option, lint rule, boundary rule, contract drift
check, token check, database test, browser assertion, or cleanup requirement was
removed or weakened.

## Cleanup and Git state

Final Stage 8 cleanup audit:

```text
Next production server / Stage 8 HTTP listener 43117 = 0
Dispatcher / Worker / Stage-owned Node children = 0
Playwright bundled Chromium children = 0
PostgreSQL listener 55432 = 0
Stage Redis listener 56379 = 0
XIANGXU containers = 0
XIANGXU volumes = 0
XIANGXU test networks = 0
temporary pnpm shim = absent
Playwright test-results / failed retry junk = absent
reviewed screenshots = 25 retained
```

Docker Desktop was running before Stage 8 and remains running. The unrelated
host Redis owner on 6379, system Chrome, other Node listeners, Docker projects,
and user-level Playwright browser cache were not modified or deleted.

The worktree intentionally contains the uncommitted Gate 4.1 Stage 0–8 body of
work. `git diff --check` passes, staged files are zero, HEAD remains the Gate 4.0
publication commit, and no commit or push was performed.

## Non-entry

Stage 8 does not decide CI browser installation/publication policy and does not
publish Gate 4.1. Those decisions remain exclusively Stage 9 work after a new
explicit human authorization.

```text
Gate 4.1 Stage 8 PASS —
Stage 9 not started.
Gate 4.2 not started.
```
