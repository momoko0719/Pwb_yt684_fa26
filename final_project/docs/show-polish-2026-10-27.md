# Show polish — report (2026-10-27)

Plan: `show-polish-plan-2026-10-27.md`. Seeds checked: **684**, **421**, **900**.

## 0. 截图复核（同日稍后）

上一轮的 14 cm 透明度**没有去掉**画面里的直角台阶。那张溪流近景里，水色停在一格一格的边上，旁边的浅色方块是露出来的地面。

原因：水面网格按 **1 米**一格搭，岸线原先就落在格子的直角边上。14 cm 只是把这条边稍微变淡，形状仍是台阶。另外，大约 60–140 米处，地面上还会再铺一层按同一张格子涂的远景水色，近看会叠出第二道方边。溪流又窄，整块地形的高低差不够，LOD 不会为了它拆细，透过水看到的河床也会是大三角。

这一轮改的是**岸线的形状**，不是再加一条宽光带：

- 剪影用约 2 米范围的地面高度，把 1 米台阶收成曲线；透明度仍按大约 1 个像素收干净。
- 水面网格向岸下多铺到 8 米，曲线落在网格里面，而不是落在网格外框上。
- 溪流水面不写深度，并稍微偏向镜头，避免地形三角形把水重新切成直边。
- 带水的地块在约 230 米内保持最细网格（约 0.6 米一格）。
- 地面上的远景水色改到 200 米以外才出现，遮罩再模糊约 5 米，避免近景双层岸。

水面上的深色云斑是波纹/焦散，不是岸线格子。这一步没有改它。

## 1. 岸线根因与修复

### Confirmed (not “colour only”)

Probe: `npx tsx scripts/probe-shore-edges.ts [seed]` → `scripts/out/shore-edges-*.json`.

| Cause | Evidence (seed 684; 421/900 same pattern) | Fix |
|---|---|---|
| **Water sheet stair silhouette** | `stairShare` **0.59** of shore edges axis-aligned to 1 m texel grid; `edgeTris` ~4k | Soft GROUND shore in `flowWater.ts`: discard only `depth < -0.06`; alpha `smoothstep(0, 0.14, depth)` — opacity follows depth, not mesh stair |
| **Surface wet weight blocks** | `surfaceWet.hardJumpShare` **0.078** (neighbour Δ>90) | Kept soft `surfaceBlend` (no island-wide blur). Far paint: `smoothstep(0.08, 0.55, light.b)` + 3×3 mask blur in `water.ts` |
| **Bank / CDLOD facets** | Steep share near shore low after gentler bank (`steepShare` ~0.01), but relief facets still possible | `STREAM.bank` 0.32→**0.22**; `UNDER_BANK` 3→**4**; steepBank split threshold `0.32`→**0.26**, range ×1.45 |
| Mask hard jumps | **0** after blur | Mask alone was not the near-shore triangle culprit |

**Not used:** metre-scale shore glow / blanket albedo blur. Soft band is ~14 cm depth only.

Visual A/B (dev, no menu): uniform albedo / cover off / fine LOD still leave sheet-stair contours until soft depth alpha — confirms geometry junction, not “tint boundary only”.

## 2. 景观变化

| Metric (684 field) | Before (`habitat-plots-684.json`) | After (`habitat-plots-684-polish.json`) |
|---|---|---|
| `cellsWithCover` | 10 000 | **13 218** |
| `patchCells` | 6 404 | **9 514** |
| `cellsAbove008` | 6 115 | **8 423** |
| amount / patchFloor / clumpsPerM2 | 0.7 / 0.30 / 2.0 | **0.78 / 0.22 / 2.15** |

Visible structure (not just blades):

- **Wet shore:** continuous sheets via dual-scale patch + bridge noise; steep banks still bare.
- **Woodland edge:** stronger edge suit; heart stays sparse understorey (litter still from surface weights).
- **Open:** large (~48 m) + mid (~22 m) islands — size variety, not uniform scatter.
- **Mid reading:** carpet/fleck/canopy mix slightly stronger in `cdlod.ts` (albedo volume; near-blade distance unchanged).

Mid impostors: **not shipped** this pass — patch + mid carpet first. Revisit if mid still flat in Walk/overview eye.

Seeds 421 / 900: same rules apply; habitats present where zones exist (probe JSONs under `scripts/out/`).

## 3. 风动变化

`atmosphere.ts` `windAt` (shared by grass / flowers):

| Term | Before | After |
|---|---|---|
| Gust travel | `uTime * 0.5`, raw noise | `uTime * 0.28`, `smoothstep(0.22, 0.78, …)` envelope |
| Gust scale on field | `0.25 + 0.9 * gust` (spikes → ~1.15×) | **`0.58 + 0.32 * gust`** |
| Flutter | `sin(2.7…)` × 0.15 | slower `2.1`, amplitude **0.07** |
| Spatial corr. | `p * 0.08` | **`p * 0.06`** (neighbours more correlated) |

Blade roots still fixed (`t*t` in `grass.ts`). Field wind retained. Continuous observe: gusts roll in/out; no wholesale amplitude kill.

## 4. 界面变化

| Item | Where |
|---|---|
| Layout → **高级生成参数 / Advanced generation** | Leva folder (collapsed); turn + variation kept |
| Nav diagnostics | **Dev** folder (not common Debug) |
| Walk unlocked | `点击进入漫游` + `关闭漫游可返回环绕视图` |
| Walk locked | `WASD 移动 · Shift 加速 · Esc 释放鼠标` · live m/s |
| Dwelling default | **10×**, label **模拟速度 / Sim speed**; not reset by Walk/Orbit |
| Scale | Terrace **group** + range **massif** boxes; category checkboxes (mass / landmarks / vegetation / person). Vegetation boxes off by default |

## 5. 验证

| Check | 684 | 421 | 900 |
|---|---|---|---|
| Shore probe attributes | Pass (stair+surface) | Same | Same |
| Habitat plots (wet/wood/open) | Pass | Pass | Pass |
| `tsc --noEmit` | Pass | — | — |
| Overview / mid / Walk continuous eye | **Owner eye** — not screenshot-verified this agent pass | | |
| Mid impostor trial | Not done | | |
| Perf FPS continuous | Not instrumented | | |

## 6. 性能与剩余

- **CPU:** cover field cells +~32%; near clumps slightly up inside larger patches — expect modest chunk-build cost when focus moves. Not timed this pass.
- **GPU:** soft shore = same fill; mid carpet mix slightly heavier (albedo only). SteepBank may draw more fine patches near streams.
- **测不到:** live FPS / GPU ms without browser profiling.

**Next most important:** Owner Walk + overview eye on shore soft edge and wet/wood/open patch reading; if mid still flat after that, small mid grass impostor trial (not longer near-blade distance).

## Commands

```
cd final_project
npx vite --port 5180 --strictPort
npx tsc --noEmit
npx tsx scripts/probe-shore-edges.ts 684
npx tsx scripts/probe-cover-habitats.ts 684
```

## Files touched

`flowWater.ts`, `water.ts`, `cdlod.ts`, `cover.ts`, `atmosphere.ts`, `Scene.tsx`, `ScaleView.tsx`, `strings.ts`, `scripts/probe-shore-edges.ts`, docs (plan/report/handoff/world-plan/presentation).
