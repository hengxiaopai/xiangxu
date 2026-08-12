# XIANGXU Gate 4.0 — Dependency and Install-Script Review

> Stage: 0 — 开工核验  
> Audited at: 2026-08-11T10:33:58+08:00  
> Status: **STAGE 0 PASS** — 只完成审查，未安装任何项目依赖。

## 1. Review Boundary

本审查覆盖 Gate 4.0 可验证工程骨架预计需要的直接依赖、已知原生二进制/构建脚本路径、registry 风险和供应链执行策略。

不在范围内：真实认证、LLM、Embedding、Connector、OAuth、外部通知、WebGL、Lenis、GSAP、ReactBits、Vanta、业务数据库模型和 Gate 4.1 功能。

## 2. SSOT Resolution / Decision Table

| Conflict or ambiguity | Higher-priority evidence | Resolution |
|---|---|---|
| Gate 3.7 与 `DESIGN_RULES.md` 的少数 token 数值不同 | Root `AGENTS.md`：Gate 3.8 > Gate 3.7 > DESIGN_RULES | Gate 3.8 明确值优先；其未覆盖且发生直接冲突时用 Gate 3.7；DESIGN_RULES 只补充不冲突的操作值。Stage 4 必须提交 Token Resolution Table。 |
| Gate 3.7 的 `color.bg.subtle=#F4F5F1`，DESIGN_RULES 为 `#F5F7F4` | Gate 3.7 优先级更高 | 初始 registry 使用 `#F4F5F1`，除非新 ADR 明确改变。 |
| Gate 3.7 的 `color.text.secondary=#4D5855`，DESIGN_RULES 为 `#606967` | Gate 3.7 优先级更高 | 初始 registry 使用 `#4D5855`。 |
| Gate 3.7 的 `color.border.default=#DCE3DF`，DESIGN_RULES 为 `#E4E9E6` | Gate 3.7 优先级更高 | 初始 registry 使用 `#DCE3DF`。 |
| Gate 3.7 的 card/surface radius 为 12/16，DESIGN_RULES 的 card/panel 为 10/12 | 上游命名并非完全同义，但存在实现歧义 | Stage 4 不静默合并；先把 semantic mapping 写入 Token Resolution Table。冲突组件暂不实现。 |
| Legacy Playbook 将 Product Design 视为 CORE | 当前 Gate 3.9R `AGENTS.md` 明确为 IF AVAILABLE ONLY | 当前规则生效；Gate 4.0 不需要 Product Design 插件。 |
| npm registry 与本机镜像的 BullMQ latest 不同 | 官方 npm registry 优先 | 不使用镜像结果锁版本；初始保守锁 `bullmq@6.0.10`。 |
| TypeScript registry latest 为 7.0.2 | typescript-eslint peer contract `<6.1.0` | 锁 `typescript@6.0.3`；拒绝“全量 latest”。 |

## 3. Direct Dependency Decisions

| Dependency group | Packages | Classification | Why needed in Gate 4.0 | Exit / replacement boundary |
|---|---|---|---|---|
| Workspace | `turbo` | dev | 单一任务图和 CI/local 命令入口 | 可替换但需重写 task graph；不影响 Domain contract |
| Web | `next`, `react`, `react-dom` | runtime | 仅 `/login`、`/app/today` App Shell | 不允许渗入 domain/application |
| Compiler/lint | `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-next` | dev | strict、flat config、单一 lint path、boundary enforcement | 配置可替换；规则强度不得降低 |
| Contracts | `zod`, `@asteasolutions/zod-to-openapi` | runtime/build | Transport validation 与 OpenAPI 3.1 artifact | Domain 不依赖 Zod；adapter 可替换而 schema contract 不变 |
| PostgreSQL | `drizzle-orm`, `pg` | runtime | infrastructure adapter 和最小 smoke | 仅 infrastructure 可导入 |
| Migration | `drizzle-kit` | dev | 生成待人工审查的 SQL migration | Production 禁止 schema push |
| Queue | `bullmq` | runtime | fake queue/job smoke | PostgreSQL Outbox 仍是耐久触发源；不保存唯一业务事实 |
| UI build | `tailwindcss`, `@tailwindcss/postcss` | dev | CSS token-aware adapter | Tailwind 不成为 token source |
| Test/runtime scripts | `vitest`, `tsx` | dev | unit/contract/boundary/worker smoke | 不允许跳过失败测试换取绿灯 |
| Types | `@types/node`, `@types/react`, `@types/react-dom` | dev | version-matched compile types | 与运行时 major 对齐 |

所有已选直接包许可证为 MIT 或 Apache-2.0。Stage 1 生成 lockfile 后仍须生成完整 license inventory；直接包审查不能替代传递依赖审查。

## 4. Registry and Provenance Findings

### 4.1 Registry mismatch

机器当前状态：

```text
npm registry: https://registry.npmmirror.com
pnpm registry: https://registry.npmmirror.com
```

核验期间，官方 registry 已暴露 `bullmq@6.0.11`，镜像仍以 `6.0.10` 为 latest。为保证来源一致和可复现：

1. 不修改用户全局 npm/pnpm 配置；
2. Gate 4.0 项目级 `pnpm-workspace.yaml` 显式设置官方 registry；
3. `packageManager` 和全部直接依赖使用精确版本；
4. lockfile 必须由官方 registry 生成并以 frozen 模式复验；
5. 任何镜像切换必须作为独立供应链决策记录。

### 4.2 pnpm 11 security defaults

pnpm 11 默认提供：

- `minimumReleaseAge: 1440`；
- `blockExoticSubdeps: true`；
- `strictDepBuilds: true`；
- `allowBuilds` 替代旧 build-dependency 配置。

Gate 4.0 保留这些安全默认值，不设置 `minimumReleaseAge: 0`，不使用宽泛的 build-script 批准。

## 5. Lifecycle / Native Binary Review

注册表审查了直接包的 `preinstall`、`install`、`postinstall`、`prepare` 字段，并检查了当前可预见的原生/二进制路径。

| Package/path | Observed lifecycle behavior | Decision before install |
|---|---|---|
| Most direct packages | 未发现 consumer `preinstall/install/postinstall` | 保持不批准 build；lockfile 后再次核验 |
| `bullmq` | 源包元数据包含 `prepare: husky`；registry tarball 安装不应执行 source prepare；无 consumer install/postinstall | 不授予 build 权限；首次安装日志必须证明未执行 Husky |
| `@asteasolutions/zod-to-openapi` | 源包元数据包含 `prepare: npm run build`；无 consumer install/postinstall | 不授予 build 权限 |
| `esbuild` | 由 `tsx`/`drizzle-kit` 间接引入；`postinstall: node install.js` | 唯一预期需要显式 `allowBuilds: { esbuild: true }` 的候选；必须先核对 lockfile version、integrity、repository |
| Next SWC platform packages | Next 16.3 的精确 optional dependency；预编译平台二进制 | 只允许 lockfile 解析到 Windows x64 对应包；不批准未知替代包 |
| `sharp` | Next optional dependency；预编译二进制路径，Node engine `>=20.9.0` | Gate 4.0 不使用图片优化能力；保持 optional，不因缺失而扩大权限 |
| Tailwind Oxide platform package | `@tailwindcss/oxide` 的精确 optional platform binary | 校验仅解析当前平台包；无必要 lifecycle 时不批准 build |
| `fsevents` | `tsx/esbuild` 路径的 macOS optional dependency | Windows 不应安装/执行；lockfile 可包含跨平台元数据 |

注意：只有生成完整 lockfile 后，才能证明传递依赖的最终集合和 integrity。Stage 0 不把“直接依赖没有脚本”误报为“整个依赖树没有脚本”。

## 6. Approved Install Procedure for Stage 1

Stage 1 只有在 Node/pnpm gap 关闭后才允许进行以下流程：

1. 记录 `node --version`，必须为 `v24.19.0`；
2. 记录 `pnpm --version`，必须为 `11.21.0`；
3. 建立最小 manifests，但不运行任意第三方初始化器/codemod；
4. 使用 `pnpm install --dry-run` 预览解析；
5. 生成 lockfile 时禁止依赖脚本执行；
6. 审查 lockfile 的 registry、integrity、optional/native packages 和所有 lifecycle candidates；
7. 在 `pnpm-workspace.yaml` 中逐包写 `allowBuilds` 决策，未知项默认 false；
8. 首次真实 install 保存完整命令、exit code、ignored/approved builds 和 frozen-lockfile 复验；
9. 运行 `pnpm ignored-builds`，任何未解释条目都阻断 Stage 1 PASS；
10. 不运行 `create-next-app`、`create-turbo` 或未经审查的 `npx/pnpm dlx` 脚手架。

禁止使用 `--ignore-scripts` 作为永久运行状态；它只允许用于首次解析/审查。最终 Gate 证据必须来自显式 allowlist 下的正常 frozen install。

## 7. Dependency Boundary Rules

| Package | Allowed dependencies | Forbidden dependencies |
|---|---|---|
| `packages/domain` | TypeScript standard language/runtime only | Next, React, Zod, Drizzle, pg, Redis, BullMQ, Provider SDK |
| `packages/application` | domain + application ports | Next, React, concrete DB/queue/provider implementation |
| `packages/infrastructure` | application/domain ports + Drizzle/pg/BullMQ adapters | UI/Next route semantics; direct invention of Domain rules |
| `packages/contracts` | Zod/OpenAPI/SSE transport definitions | DB rows as public schema; Domain mutation logic |
| `packages/ui` | React + semantic DTO/component props + CSS tokens | Drizzle/pg/Redis/BullMQ/provider SDK/raw DB rows |
| `apps/web` | application/contracts/ui and explicit infrastructure composition root | direct Domain table mutation or provider bypass |
| `apps/worker` | application contracts + explicit infrastructure composition root | direct Domain table mutation or real Provider work in Gate 4.0 |

## 8. Rejected / Deferred Dependencies

| Dependency/category | Decision | Reason |
|---|---|---|
| OpenAI/Anthropic/other AI SDK | REJECT | Gate 4.0 forbids real AI Provider |
| SMS/WeChat/OAuth/Calendar/Email SDK | REJECT | Provider/Connector boundary |
| ReactBits/Vanta | REJECT | Lab-only and explicitly forbidden as core dependency |
| GSAP/Motion/Lenis/WebGL stack | DEFER | Gate 4.0 Shell does not need signature motion or spatial UI |
| shadcn CLI/registry install | DEFER | No primitive gap yet; default visual must not define XIANGXU |
| Prisma/other ORM | REJECT | Drizzle is frozen implementation profile |
| WebSocket/CRDT libraries | REJECT | Realtime baseline is SSE; no collaborative state in Gate 4.0 |
| Auth frameworks | REJECT | `/login` is placeholder only |
| `create-next-app` / `create-turbo` executors | REJECT | Unnecessary broad generator and unaudited file/dependency surface |

## 9. Known Risks and Blocking Rules

| Risk | Control |
|---|---|
| Node 24 is not active | No dependency install before exact runtime proof |
| pnpm 11 is not active | No workspace lockfile before exact package-manager proof |
| Official/mirror registry drift | Project-level official registry and integrity-bearing lockfile |
| Docker daemon stopped | Stage 5 cannot start or pass until daemon evidence exists |
| Host PostgreSQL 16 port collision | Non-destructive host port 55432 mapping for project PostgreSQL 18 |
| Transitive build scripts unknown until resolution | Script-disabled lockfile generation, graph review, explicit `allowBuilds` |
| Token conflict could leak into UI dependencies | Stage 4 Token Resolution Table before semantic component implementation |
| A dependency pressures architecture bypass | Reject dependency or stop and draft ADR; never adapt Domain to library convenience |

## 10. Stage Result

**Stage 0 PASS.**

Dependency necessity, exact direct versions, license class, compatibility, registry provenance, known lifecycle paths, install policy, environment gaps and deferred packages have been recorded. No project dependency was installed, and no project lifecycle script was executed.

Stage 1 尚未开始。Gate 4.1 未开始。
