# XIANGXU Gate 4.0 / Stage 4 Token Resolution

> Scope: Contracts & UI Foundation only  
> Resolution order: Gate 3.8 > Gate 3.7 > `DESIGN_RULES.md`  
> Rule: one resolved value per token; consuming UI uses semantic variables, never a parallel registry.

## 1. Color Resolution

| Token | Gate 3.7 | Gate 3.8 | DESIGN_RULES | Resolved | Winning source | Reason |
|---|---|---|---|---|---|---|
| `color.bg.canvas` | `#FAFAF7` | `#FAFAF7` | `#FAFAF7` | `#FAFAF7` | Gate 3.8 | All sources agree. |
| `color.bg.surface` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | Gate 3.8 | All sources agree. |
| `color.bg.subtle` | `#F4F5F1` | — | `#F5F7F4` | `#F4F5F1` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.text.primary` | `#18201E` | `#18201E` | `#18201E` | `#18201E` | Gate 3.8 | All sources agree. |
| `color.text.secondary` | `#4D5855` | — | `#606967` | `#4D5855` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.text.tertiary` | `#74807C` | — | `#909795` | `#74807C` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.border.default` | `#DCE3DF` | — | `#E4E9E6` | `#DCE3DF` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.border.strong` | — | — | `#CBD5D0` | `#CBD5D0` | DESIGN_RULES | Lower source fills an uncovered token. |
| `color.brand.primary` | `#0B493D` | `#0B493D` | `#0B493D` | `#0B493D` | Gate 3.8 | All sources agree. |
| `color.brand.hover` | `#0E5A49` | — | `#0E5143` | `#0E5A49` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.brand.soft` | — | — | `#E8F1ED` | `#E8F1ED` | DESIGN_RULES | Lower source fills an uncovered token. |
| `color.ai.surface` | `#EAF8F7` | `#EAF8F7` | `#EAF8F7` | `#EAF8F7` | Gate 3.8 | All sources agree. |
| `color.ai.border` | `#CBEDE9` | — | `#D3ECE7` | `#CBEDE9` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.ai.text` | `#125E57` | — | — | `#125E57` | Gate 3.7 | Only exact upstream value. |
| `color.attention.sand` | `#D5A673` | `#D5A673` | `#D5A673` | `#D5A673` | Gate 3.8 | All sources agree. |
| `color.success` | `#2F775F` | — | `#2F7D63` | `#2F775F` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.warning` | — | — | `#B7793E` | `#B7793E` | DESIGN_RULES | Lower source fills an uncovered token. |
| `color.danger` | `#B94A48` | — | `#B5544E` | `#B94A48` | Gate 3.7 | Direct conflict; higher source wins. |
| `color.info` | — | — | `#527D8F` | `#527D8F` | DESIGN_RULES | Lower source fills an uncovered token. |

## 2. Quiet Dark Resolution

Gate 3.8 requires semantic dark overrides but does not freeze exact values. Gate 3.7 freezes Quiet Dark behavior but not exact core values. `DESIGN_RULES.md` therefore supplies the uncovered exact values.

| Token | Gate 3.7 | Gate 3.8 | DESIGN_RULES | Resolved | Winning source | Reason |
|---|---|---|---|---|---|---|
| `dark.bg.canvas` | no pure black | semantic override required | `#101615` | `#101615` | DESIGN_RULES | Exact value satisfies both higher-level constraints. |
| `dark.bg.surface` | luminance separates layers | semantic override required | `#161D1B` | `#161D1B` | DESIGN_RULES | Exact uncovered value. |
| `dark.text.primary` | AA contrast | semantic override required | `#EEF3F0` | `#EEF3F0` | DESIGN_RULES | Exact uncovered value. |
| `dark.text.secondary` | AA contrast | semantic override required | `#AAB5B0` | `#AAB5B0` | DESIGN_RULES | Exact uncovered value. |
| `dark.border.default` | border, not glow | semantic override required | `rgba(255,255,255,.08)` | `rgba(255,255,255,.08)` | DESIGN_RULES | Exact uncovered value; primitive-layer raw value only. |
| `dark.ai.surface` | reduced saturation | semantic override required | `#152624` | `#152624` | DESIGN_RULES | Exact uncovered value. |

Dark components consume the same semantic names as Light. They do not select raw colors or create a second component token set.

## 3. Spacing and Layout Resolution

Gate 3.7 freezes the 4px micro-unit and exact scale `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80`. `DESIGN_RULES.md` agrees through 64px. Stage 4 resolves the component scale to `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`; 80px remains a rare narrative token and is not used by the foundation components.

| Token | Gate 3.7 | Gate 3.8 | DESIGN_RULES | Resolved | Winning source | Reason |
|---|---|---|---|---|---|---|
| `shell.sidebar.width` | `232px` | `232px` | `232px` | `232px` | Gate 3.8 | All sources agree. |
| `shell.topbar.height` | `56px` | `56px` | `56px` | `56px` | Gate 3.8 | All sources agree. |
| `shell.rail.width` | `320px` | `320px` | `320px` | `320px` | Gate 3.8 | All sources agree. |
| `layout.canvas.gutter` | `32px`, wide `48px` | — | desktop `24px` | `32px`, wide `48px` | Gate 3.7 | Direct conflict; higher source wins. Stage 4 shell uses 32px only. |

## 4. Radius, Border, and Focus Resolution

| Token / semantic role | Gate 3.7 | Gate 3.8 | DESIGN_RULES | Resolved | Winning source | Reason |
|---|---|---|---|---|---|---|
| `radius.control` | `8px` | — | Button/Input `8px` | `8px` | Gate 3.7 | Sources agree. |
| `radius.card` | ordinary card `12px` | — | small interactive card `10px`; panel `12px` | `12px` | Gate 3.7 | Stage 4 `Surface` maps to ordinary card/panel, not small interactive card. |
| `radius.surface` | major surface `16px` | — | large/modal `16px` | `16px` | Gate 3.7 | Sources agree. Reserved for `Surface size="major"`. |
| `radius.pill` | `999px`, tags only | — | `999px`, tags only | `999px` | Gate 3.7 | Sources agree; Stage 4 components do not use pill radius. |
| `border.default.width` | `1px` | — | `1px` | `1px` | Gate 3.7 | Sources agree. |
| `focus.width` | visible indicator | — | `2px` semantic ring | `2px` | DESIGN_RULES | Exact value fills the higher-level accessibility requirement. |
| `focus.color` | semantic token | — | semantic token | Light `brand.primary`; Dark `ai.border` | Gate 3.7 mapping | Uses resolved colors and remains visible across themes. |

The unresolved 10px “small interactive card” role is not implemented in Stage 4. No component silently aliases it to the 12px ordinary Surface.

## 5. Typography Resolution

The system stack is frozen as `PingFang SC`, `Microsoft YaHei`, `Noto Sans CJK SC`, `system-ui`, `-apple-system`, `sans-serif`. No Webfont dependency is added.

| Token | Gate 3.7 range | Gate 3.8 | DESIGN_RULES | Resolved | Winning source / reason |
|---|---|---|---|---|---|
| `type.display` | 36–48 / 1.10, 600–700 | system CJK | 40/48, 700 | `40px / 48px / 700` | DESIGN_RULES exact value is inside Gate 3.7 range. |
| `type.page-title` | 28–32 / 1.18, 600–700 | system CJK | 28/36, 650 | `28px / 36px / 650` | Exact lower-source value satisfies Gate 3.7 range. |
| `type.section-title` | 20–24 / 1.25, 600 | system CJK | 18/26, 600 | `20px / 26px / 600` | Gate 3.7 minimum wins the direct size conflict. |
| `type.panel-title` | 15–17 / 1.35, 600 | system CJK | 15/22, 600 | `15px / 22px / 600` | Exact value satisfies Gate 3.7 range. |
| `type.body` | 14–16 / 1.55, 400 | system CJK | 14/22, 400 | `14px / 22px / 400` | Exact value satisfies Gate 3.7 range. |
| `type.ui-label` | 13–14 / 1.35, 500–600 | system CJK | 13/20, 500 | `13px / 20px / 500` | Exact value satisfies Gate 3.7 range. |
| `type.caption` | 12–13 / 1.35, 400–500 | system CJK | 12/18, 400 | `12px / 18px / 400` | Exact value satisfies Gate 3.7 range. |

## 6. Component Mapping Frozen for Stage 4

- `Button`: semantic `tone="primary|secondary"`, `size="sm|md|lg"`; control radius and approved control heights only.
- `Surface`: semantic `tone="default|subtle|intelligence"`, `size="default|major"`, semantic padding only.
- Components consume component tokens which map to semantic tokens; components never contain raw color or spacing values.
- `apps/web` consumes `@xiangxu/ui`; it does not own another token registry.
- Modal, Dropdown, Calendar, TaskCard, ProposalCard, Sidebar system, and Command Palette remain deferred.
