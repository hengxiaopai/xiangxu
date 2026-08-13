# XIANGXU — Gate 4.1 Stage 9 Final Audit

## Formal disposition rule

```text
Gate 4.1 Stage 9 PASS — Gate 4.1 CLOSED
if and only if local HEAD, origin/main, and a successful GitHub Hosted CI
head_sha identify the same final publication-recovery commit.
```

Stage 9 began only after explicit human authorization. This phase audited the
complete uncommitted Gate 4.1 Stage 0–8 candidate, repaired verification-only
publication gaps, reproduced the candidate from a clean directory, and froze
the publication boundary. It added no product feature, public API, DTO,
Application command/query, database object, migration, dependency, provider,
Connector, or browser channel.

The local audit initially performed no staging, commit, push, tag, release, or
publication. Separate human publication authorization was later granted. The
initial candidate was committed and pushed as
`cc782682e15c3a89643550d6937d56e035aedd9b`; its exact hosted run exposed two
platform-specific browser-verification gaps and correctly prevented closure.
No tag or release was created.

## Frozen baseline and integrity

| Item | Stage 9 result |
| --- | --- |
| branch | `main` |
| local-audit entry HEAD | `a3183a026fea893b66c7b72dd65ce0f15d7fa572` |
| initial publication commit | `cc782682e15c3a89643550d6937d56e035aedd9b` |
| initial hosted run | `31696961596`; unified verification PASS; browser verification FAIL |
| `pnpm-lock.yaml` SHA-256 | `362266dbd547e1e1adc774425afbd3daca70bbb4e2543cf05a5ad605d8610b1e` |
| OpenAPI SHA-256 | `87abca9aa46c4d1263f53f4591fc03ad05cde729ee0ed53cf34159803f6fc78f` |
| migration count | 6; `0000` through `0005`; no `0006` |
| Handoff manifest SHA-256 | `8d48cb4cba930587674e546f83b4e80afc0a548c5fa338820dec54e3861270cc` |
| Handoff pre/post | 32 / 32; byte-identical and read only |

Frozen migration hashes remained byte-identical:

```text
0000_motionless_bloodaxe.sql 5423388f0827b2c94c8ab01a26d6198749c06ddcffdb3e9c70ef6c95c7b8ccfe
0001_noisy_ravenous.sql      cfb4e8139ba60f85f9a1b9472e03b3cd914ca333c39fd28a81f1998618bbf79d
0002_spotty_mindworm.sql     524ebabff73582a52a8ff32b1be35b0f78dd0d5a9918ced5051ac54981002bfc
0003_mean_argent.sql         fefa9806107faf7b057479f93ce5176e0e3a6ddc8ddec97dad24e4a99bddc1f5
0004_normal_sabra.sql        e89081fbcdc578649d3c7a0e688d49e5a93f40ce9a58669c319902cd1267a6f3
0005_empty_whirlwind.sql     c34dfe74955a42c9011f7f7fbd391c99a66349effc9f2eafae5ba4d428f38658
```

All 32 direct dependencies remain exact-versioned or `workspace:*`; no
dependency was added or changed by Stage 9. The only executed lifecycle scripts
were the already approved exact `esbuild@0.18.20`, `esbuild@0.25.12`, and
`esbuild@0.28.2`. Exact `msgpackr-extract@3.0.4` and `fsevents@2.3.2` remained
explicitly denied, and no other package build script was enabled.

## Publication-readiness corrections

### Hosted CI browser proof

The Stage 8 browser suite was local-only. The publication workflow previously
ran `pnpm verify` but did not install or execute the approved Playwright browser.
Stage 9 now makes hosted CI:

1. assert exact Playwright `1.62.0`, Chromium `v1234`, Chrome for Testing
   `151.0.7922.34`, the official Playwright CDN provenance, and empty host
   overrides;
2. install only `chromium`, never all browsers and never `--with-deps`;
3. run all browser functional, isolation, IndexedDB, SSE, responsive geometry,
   contrast, keyboard, and reduced-motion assertions on Ubuntu while retaining
   strict zero-difference pixel comparison on the reviewed Windows baseline;
4. run cleanup assertions even after an earlier failure and fail if Stage-owned
   networks or Playwright browser processes survive cleanup.

The CI policy checker and its negative fixture were expanded to enforce those
requirements. The self-test passed with the real workflow at zero violations
and the negative fixture at one rejected workflow with 43 expected violations.

### Clean-room rebuild prerequisite

The first clean-room database rebuild failed closed because
`db:rebuild:smoke` assumed `apps/worker/dist/proposal-processor.js` already
existed. Root `db:rebuild:smoke` now builds the Worker before launching the
infrastructure rebuild. The rerun passed both fresh database cycles. This is a
verification-order correction only; Worker implementation and runtime behavior
are unchanged.

## Clean-room dependency recovery

The candidate was copied to a new OS temporary directory without `.git`, the
read-only Handoff, `node_modules`, build output, or prior test output. A first
fresh frozen installation was terminated at the repository's 90-second
no-output threshold. A second observable attempt downloaded 232 of 237 packages
and failed on a registry timeout. Offline fallback correctly failed because the
Next.js tarball was not cached.

The approved Stage 0 Recovery A route was then used: only the pnpm child process
received the already-running local Windows proxy. Repository registry
configuration remained exactly `https://registry.npmjs.org/`; no user-global
setting, mirror, lockfile, manifest, integrity value, or dependency version was
changed. The fresh frozen installation completed with 237 packages and the
lockfile hash remained unchanged.

## Clean-room verification

```text
Node: v24.19.0
pnpm: 11.21.0
pnpm install --frozen-lockfile: PASS, 9 workspace projects / 237 packages
pnpm db:generate: PASS, no schema changes / migrations 6

pnpm db:rebuild:smoke: PASS
  cycle 1: PostgreSQL 18.4 / migrations 6 / DB integration 52 of 52 / sentinel 0
  cycle 2: PostgreSQL 18.4 / migrations 6 / DB integration 52 of 52 / sentinel 0

pnpm ci:check: PASS, real 0 / negative 1 / 43 expected violations
pnpm lint: PASS
pnpm typecheck: PASS, 8 of 8 workspaces
pnpm boundary: PASS, 8 workspaces / 114 source files / 7 edges
pnpm boundary:test: PASS, positive 0 / negative 1 / 63 violations
pnpm contracts:check: PASS, byte-stable
pnpm tokens:check: PASS, 45 files
pnpm test: PASS, 10 of 10 workspace tasks
pnpm build: PASS, 4 of 4 build tasks including Next production build
pnpm verify: PASS, canonical full graph and infrastructure cleanup
pnpm browser:verify: PASS, 9 of 9 / 25 unchanged visual baselines
```

Browser verification used the approved bundled Playwright Chromium only. It ran
the real Next production build with PostgreSQL 18.4, Redis 8.2.8, Worker, and
Outbox dispatcher. Actor-isolated auth/SSE/TanStack behavior, real IndexedDB
reload/offline/Auth Epoch safety, desktop/mobile Light/Dark responsiveness,
keyboard behavior, reduced motion, and visual baselines all passed without a
baseline update.

No compiler option, lint rule, boundary rule, contract drift check, token
boundary, database assertion, browser assertion, security invariant, or cleanup
requirement was removed or weakened.

## Hosted publication recovery

The first exact-commit hosted run `31696961596` targeted initial publication
commit `cc782682e15c3a89643550d6937d56e035aedd9b`. Checkout, exact Node/pnpm,
frozen installation, lifecycle policy, Docker, Chromium provenance and install,
and canonical `pnpm verify` all passed. Production Chromium then failed on:

1. Chrome on Linux reporting `ERR_INCOMPLETE_CHUNKED_ENCODING` while the test
   intentionally restarted Next.js to prove SSE replay; and
2. Ubuntu font rasterization differing from reviewed Windows PNGs while the
   test still enforced `maxDiffPixels: 0`.

Human Recovery authorization approved only these bounded changes:

- allow the exact incomplete-chunk diagnostic only in the intentional SSE
  restart test;
- keep local reviewed Windows PNG comparison strict and unchanged;
- use `semantic-only` on the Ubuntu Hosted Runner while still running all nine
  browser scenarios and all non-pixel visual/accessibility assertions;
- require the hosted cleanup assertion to run with `always()`.

Local recovery evidence:

```text
CI policy self-test: PASS, real 0 / negative 1 / 43 expected violations
targeted ESLint: PASS
Hosted-equivalent semantic-only browser verification: PASS, 9 / 9
Windows strict visual baseline verification: PASS, 2 / 2 tests / 25 PNGs
pnpm verify: PASS, including PostgreSQL 18.4 DB integration 52 / 52,
  Redis 8.2.8, BullMQ, production HTTP, and cleanup
reviewed PNG modifications: 0
```

An all-nine strict Windows invocation reached Playwright status `passed`, but
its outer tool task hit the 90-second limit during final return. It was treated
as inconclusive, all process/container/network residue was audited as zero, its
generated result directory was removed, and the smaller isolated strict visual
batch above completed with an explicit exit-zero result.

The first local recovery `pnpm verify` reached only infrastructure startup and
failed closed because an unrelated Docker/WSL Redis relay already owned host
port 6379. Stage-owned resources were automatically removed. The complete
command then passed with the already reviewed local fallback
`XIANGXU_STAGE5_REDIS_TEST_PORT=56379`; the unrelated host process was neither
stopped nor modified.

## Publication-set review

The initial candidate contains the complete accumulated Gate 4.1 Stage 0–9
work. It contained 197 files totaling
2,578,782 bytes: 48 modified tracked files and 149 untracked files. Review
covered dependency exactness, lifecycle policy, environment files, credential
patterns, generated artifacts, migrations, OpenAPI, screenshots, and
`git diff --check`.

The two credential-pattern file hits are expected and non-secret: `.env.example`
contains the explicit `replace-with-local-only-password` placeholder, and the
existing infrastructure test harness creates an ephemeral localhost PostgreSQL
password and stores it in a mode-`0600` OS temporary file. No private key,
GitHub, AWS, OpenAI, Slack, Google, or embedded credential secret was found.

The 25 reviewed Stage 8 PNG baselines are intentional publication artifacts.
No retry screenshot, trace, video, Playwright report, transient database file,
container, volume, or network is part of the candidate.

## Publication checkpoint

Final publication authorization and the initial candidate publication are
complete. Because the initial exact run failed, it does not close the Gate. The
approved recovery closes Gate 4.1 only after all of these conditions pass:

```text
1. commit and push only the reviewed bounded recovery to main;
2. require successful GitHub Hosted Runner CI for that exact recovery head_sha;
3. verify local HEAD, origin/main, remote refs/heads/main, and hosted head_sha
   all identify that same commit;
4. verify the final local worktree is clean and Handoff remains 32 / 32.
```

When those conditions are true, the formal repository state is:

```text
Gate 4.1 Stage 9 PASS — Gate 4.1 CLOSED.
Gate 4.2 may start under its already approved product-development direction.
```
