# Wonderland — hand-off

Plan: `wonderland-world-plan.md`. Show: `presentation-notes.md`.  
**This pass:** 只读核实，没有改功能。计划见 `living-island-next-plan.md`。上一轮山色仍是 `fold-tint-simplify-2026-10-27.md`（默认强度 1）。  
Prior wrap: `wrap-grass-rim-flower-mountain-2026-10-27.md`.

## Run

```
cd final_project
npx vite --port 5180 --strictPort
npx tsc --noEmit -p .
npx tsx scripts/probe-living-read.ts 684
npx tsx scripts/probe-fold-faces.ts 684
npx tsx scripts/probe-grass-focus.ts 684 -40 20
npx tsx scripts/probe-rim-join.ts 684
npx tsx scripts/probe-flower-browse.ts 684,5676,7,42
npx tsx scripts/probe-drink-shore.ts 5676
npx tsx scripts/probe-shrub-tones.ts 684,5676,7,42
```

`/#/atlas/wonderland-terrain` · seed **684**. 收起 Leva 侧栏再目视。  
Look at it → 近草／花；Island overview → 岛缘／山色。

## Read order

1. `living-island-next-plan.md` — 路线、休息处、成玉、花的核实，以及石头之后的顺序。本轮没有改这些系统。  
2. `wrap-grass-rim-flower-mountain-2026-10-27.md`（五问＋阶段）  
3. `coverFocus.ts` + `CoverGrass.tsx` — 脚保留；**pending assemble**（停住也装配）  
4. `rimJoin.ts` + `rimWall.ts` + CDLOD `uOutlineKeep` — 共享岛缘规则  
5. `cover.ts` 花锚点；`rockFolds.ts` 横坡宽凹；`corner.tsx` `SHOW_WATCH_STELE`

## 本轮结论（短）

- **这一轮：** 没有改寻路、休息处、成玉、草花或山色。诊断脚本 `scripts/probe-living-read.ts`。路线图 `docs/living-island-routes-684.svg`。  
- **草：** 停住不显示＝缺 pending 装配，不是「必须加载慢」。脚本通过；Walk／连转 **未完目视**。  
- **岛缘：** 共享 `RIM_JOIN`（顶皮 keep 带＋法兰 solid／inset＋中点加密）。脚本 coverOk；瀑布／LOD **未完目视**。  
- **花：** 扩覆盖（max 144／sep 4.6）；普通机位脚本多数 OK；seed 7 开敞岛仍薄。  
- **山色：** 正常画面只用 6m／18m 山褶。横坡宽凹和 gate 不参与染色。**弃用**高度三色带、各向同性大碗，以及「过 0.30 就整面换成深橄榄」。  
- **石碑：** 隐藏时无障碍 footprint。

## Deprecated

- 山顶／山腰／山脚三色带。  
- 「附近唯一合法饮水站」绝对表述（用 `probe-drink-shore` 真岸线表）。

## Remaining

1. 草：停等、抬头低头、Walk 去回、Orbit — 收侧栏目视。  
2. 岛缘四种子：外侧、瀑布口、连续缩放。  
3. 花三机位实拍。山色总览／中景对照已做（种子 684）。  
4. **下一步（未开始）：** 给现有的家加低卧石和干岸石，见 `living-island-next-plan.md`。鱼和多生灵仍在其后。

## 性能备注

法兰三角约 ×2；花簇上限 144。GPU **未测**。
