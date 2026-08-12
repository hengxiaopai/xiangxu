# XIANGXU Gate 4.0 — Versions Lock

> Stage: 0 — 开工核验  
> Audited at: 2026-08-11T10:33:58+08:00  
> Repository root: `G:\codex\xiangxu`  
> Status: **STAGE 0 PASS** — 版本与环境差距已识别；Stage 1 尚未开始。

## 1. Scope

本文件只冻结 Gate 4.0 工程骨架使用的运行时、工具、直接依赖和本地基础设施版本。此次核验没有初始化 Git、没有创建 workspace、没有安装依赖、没有启动 Docker，也没有进入 Gate 4.1。

交接包 `XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/` 保持原位且未修改。

## 2. SSOT Resolution

| Decision | Resolution | Basis |
|---|---|---|
| Runtime | Node.js 24 LTS | Gate 3.8 / Gate 3.9R / CURRENT_GATE 一致要求 Node 24。 |
| Package manager | pnpm 11，精确锁版本 | Gate 3.8 / Gate 3.9R 一致要求 pnpm 11；pnpm 11 要求 Node.js 22+。 |
| Web | Next.js 16 App Router | Gate 3.8 冻结；只创建 `/login` 与 `/app/today` 空壳。 |
| Database | PostgreSQL 18 容器 | Gate 3.8 冻结；本机 PostgreSQL 16 不作为项目事实库。 |
| Queue | Redis + BullMQ fake smoke | CURRENT_GATE 要求；不创建真实业务 Job。 |
| TypeScript | 6.0.3，而非注册表 latest 7.0.2 | `typescript-eslint@8.67.0` peer range 为 `>=4.8.4 <6.1.0`。 |
| ESLint | ESLint 10 flat config | 当前 ESLint 9 已结束维护；Next 16.3 与 typescript-eslint 均声明兼容 ESLint 10。 |
| Registry | `https://registry.npmjs.org/` | 本机配置的 npmmirror 出现版本滞后；版本核验以官方 npm registry 为准。 |

## 3. Machine Evidence

| Item | Required / planned | Actual on machine | Status |
|---|---:|---:|---|
| Windows | supported development host | Windows NT 10.0.26100.0 | PASS |
| PowerShell | 5.1+ | 5.1.26100.8875 | PASS |
| Git | current supported | 2.51.0.windows.1 | PASS |
| Node.js | 24 LTS | 22.16.0 at `E:\sofeware\nodejs\node.exe` | GAP-01 |
| npm | bundled with selected Node | 10.9.2 | INFORMATIONAL |
| Corepack | package-manager bootstrap | 0.32.0; its current pnpm shim resolves to 10.33.2 | GAP-02 |
| global pnpm | 11.21.0 | 9.0.2 at user npm global path | GAP-02 |
| Docker Desktop | installed | 4.85.0.235549 | PASS |
| Docker CLI | installed | 29.6.2 | PASS |
| Docker Compose | installed | 5.3.1 | PASS |
| Docker daemon | running when container checks start | `desktop-linux`; daemon not running; `com.docker.service` stopped | GAP-03 |
| Hypervisor | available | present | PASS |
| PostgreSQL client/server | project uses 18.4 container | local service `postgresql-x64-16`, PostgreSQL 16.14 | GAP-04 |
| Port 5432 | available or remapped | occupied by local PostgreSQL 16 | GAP-04 |
| Redis | project uses container | no local executable; port 6379 free | EXPECTED |
| Turborepo / Next / ESLint / Drizzle | project-local only | not globally installed | EXPECTED |
| TypeScript global | project-local version wins | global 5.7.3 | INFORMATIONAL |
| Git repository | absent before Stage 1 | not initialized | EXPECTED |

## 4. Locked Runtime and Infrastructure

| Component | Locked version / image | Verification |
|---|---|---|
| Node.js | `24.19.0` LTS “Krypton” | Latest Node 24 LTS entry in official `nodejs.org/dist/index.json` on audit date. |
| pnpm | `11.21.0` | Official npm registry latest stable v11 on audit date; engine `node >=22.13`. |
| PostgreSQL | `postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382` | PostgreSQL official current minor is 18.4; Docker Official Image manifest-list digest checked through Docker Hub API. |
| Redis | `redis:8.2.8-bookworm@sha256:2f7462b9e93e0a7ae2edf3a0a0babc8a4d29f8bfc50849b906b7caaef925edc1` | Redis 8.2 is GA with published long support window; BullMQ supports Redis 6.2+. Docker Official Image digest checked through Docker Hub API. |
| PostgreSQL host port | `55432 -> 5432` | Avoids stopping or replacing the user's existing PostgreSQL 16 service on host port 5432. |
| Redis host port | `6379 -> 6379` | Port was free during audit. |

Image digests above are multi-platform manifest-list digests. Stage 5 must record the resolved `linux/amd64` child digest after Docker daemon startup and must not silently change the pinned tag.

## 5. Locked JavaScript Packages

All versions are exact; no caret/tilde will be used in the initial Gate 4.0 lockfile.

| Package | Version | Role |
|---|---:|---|
| `turbo` | 2.10.9 | workspace task graph |
| `next` | 16.3.0 | Web App Router shell |
| `react` | 19.2.8 | Web UI runtime |
| `react-dom` | 19.2.8 | Web DOM runtime |
| `typescript` | 6.0.3 | strict compiler; selected for linter compatibility |
| `eslint` | 10.8.1 | single lint path, flat config |
| `@eslint/js` | 10.0.1 | ESLint recommended flat config |
| `typescript-eslint` | 8.67.0 | TypeScript parser/rules |
| `eslint-config-next` | 16.3.0 | version-matched Next rules |
| `zod` | 4.4.3 | transport runtime validation |
| `@asteasolutions/zod-to-openapi` | 9.1.0 | Zod 4 to OpenAPI 3.1 generation |
| `drizzle-orm` | 0.45.2 | PostgreSQL adapter ORM |
| `drizzle-kit` | 0.31.10 | reviewed migration generation |
| `pg` | 8.23.0 | PostgreSQL driver |
| `bullmq` | 6.0.10 | conservative published v6 pin; fake queue only |
| `tailwindcss` | 4.3.3 | token-aware utility adapter |
| `@tailwindcss/postcss` | 4.3.3 | Tailwind v4 PostCSS adapter |
| `vitest` | 4.1.10 | unit/contract/boundary smoke runner |
| `tsx` | 4.23.12 | TypeScript worker/dev script runner |
| `@types/node` | 24.13.3 | Node 24 type line, not latest Node 26 types |
| `@types/react` | 19.2.18 | React types |
| `@types/react-dom` | 19.2.4 | React DOM types |

`bullmq@6.0.11` was visible on the official registry during the audit while the machine-configured mirror still exposed `6.0.10`. To avoid a same-day/mirror-lag race under pnpm 11's default release-age protection, Gate 4.0 initially locks `6.0.10`. Upgrading it requires a separate dependency diff and smoke rerun.

## 6. Compatibility Matrix

| Combination | Evidence | Result |
|---|---|---|
| Node 24.19 + pnpm 11.21 | pnpm engine is `>=22.13`; Node 24 satisfies it | PASS |
| Node 24.19 + Next 16.3 | Next engine is `>=20.9.0` | PASS |
| Next 16.3 + React 19.2.8 | Next peer accepts React `^19.0.0`; React DOM requires matching React 19.2.8 | PASS |
| TypeScript 6.0.3 + typescript-eslint 8.67 | peer range `<6.1.0` | PASS |
| ESLint 10.8 + typescript-eslint 8.67 | peer accepts ESLint 10 | PASS |
| ESLint 10.8 + Next config 16.3 | Next config peer accepts ESLint `>=9` | PASS |
| Zod 4.4 + zod-to-openapi 9.1 | OpenAPI adapter peer requires Zod `^4.0.0` | PASS |
| Drizzle 0.45 + pg 8.23 | Drizzle peer accepts `pg >8`; pg engine accepts Node 24 | PASS |
| BullMQ 6.0.10 + Redis 8.2.8 | BullMQ documentation supports Redis 6.2+ | PASS |
| TypeScript 7.0.2 + typescript-eslint 8.67 | linter peer requires TypeScript `<6.1.0` | REJECTED |

## 7. Environment Gap Analysis

| Gap | Impact | Required resolution | Blocking point |
|---|---|---|---|
| GAP-01 Node is 22.16, not 24.19 | Cannot claim frozen runtime baseline | Install/select Node 24.19 before the first workspace dependency install; re-record `node --version` | Before Stage 1 dependency resolution |
| GAP-02 pnpm is 9 globally and 10 through Corepack | Wrong lockfile/config semantics | Activate exact pnpm 11.21 through Corepack/project `packageManager`; never rely on global pnpm | Before Stage 1 workspace install |
| GAP-03 Docker daemon is stopped | Container manifests cannot run locally | Start Docker Desktop explicitly before Stage 5; record daemon/server version | Before Stage 5 |
| GAP-04 PostgreSQL 16 occupies 5432 | Default Compose mapping would collide | Keep local service untouched and map project PostgreSQL 18 to host 55432 | Before Stage 5 |
| GAP-05 npm/pnpm registry points to npmmirror | Mirror lag can change resolution and evidence | Project `pnpm-workspace.yaml` must set official registry; do not mutate user global config | Before lockfile generation |
| GAP-06 direct and transitive build scripts not yet represented by a lockfile | Cannot grant install-script trust package-by-package yet | Generate lockfile with scripts disabled, inspect full graph, then commit explicit pnpm 11 `allowBuilds` decisions | Before first script-enabled install |

These gaps do not make the Stage 0 audit incomplete: each has an observed fact, impact, resolution and blocking point. They do prevent the affected later Stage from passing until closed.

## 8. Official Sources

- Node release schedule and LTS status: https://nodejs.org/en/about/previous-releases
- Node release index: https://nodejs.org/dist/index.json
- Node 22 → 24 migration notes: https://nodejs.org/en/blog/migrations/v22-to-v24
- pnpm 11 release and security defaults: https://pnpm.io/blog/releases/11.0
- pnpm installation: https://pnpm.io/installation
- pnpm build-script approvals: https://pnpm.io/cli/approve-builds
- Next.js 16 upgrade/runtime requirements: https://nextjs.org/docs/app/guides/upgrading/version-16
- Turborepo documentation: https://turborepo.com/repo/docs
- ESLint v10 migration context: https://eslint.org/blog/2025/10/whats-coming-in-eslint-10.0.0/
- PostgreSQL version policy: https://www.postgresql.org/support/versioning/
- Redis version management: https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/
- BullMQ Redis compatibility: https://docs.bullmq.io/guide/redis-tm-compatibility
- Drizzle PostgreSQL guide: https://orm.drizzle.team/docs/get-started/postgresql-new
- Zod 4 documentation: https://zod.dev/
- npm lifecycle scripts: https://docs.npmjs.com/cli/using-npm/scripts/
- Official npm registry metadata: https://registry.npmjs.org/
- Docker Official Image tag metadata: https://hub.docker.com/v2/repositories/library/

## 9. Stage Result

**Stage 0 PASS.**

版本、兼容性、安装脚本风险和环境差距均已形成可复核记录。Stage 1 尚未开始；Gate 4.1 未开始。
