# Wonderland — hand-off

Plan: `wonderland-world-plan.md`. Show: `presentation-notes.md`.  
**This pass:** 岩窝顶板收成一块钝边的板，门边的齿和颊侧鼓包去掉了。记录在 `rock-shelter-slab-2026-10-28.md` 末节。内部净空、卧姿和进出没改。岸石保持。家和饮水站没挪。山色仍是 `fold-tint-simplify-2026-10-27.md`（默认强度 1）。只撤更早的石头步时用 `habitat-stones-2026-10-27.md` 里的 `git checkout`，不要 `git reset --hard`。多生灵可以共用接触累积，但当前这张图的覆盖范围还要单独设计，见 `living-island-next-plan.md` 第 6 节。  
Prior wrap: `wrap-grass-rim-flower-mountain-2026-10-27.md`.

## Run

```
cd final_project
npx vite --port 5180 --strictPort
npx tsc --noEmit -p .
npx tsx scripts/probe-living-read.ts 684
npx tsx scripts/probe-rock-shelter.ts 684
npx tsx scripts/probe-rock-shelter.ts 5676,7,42
npx tsx scripts/check-world.ts 684,5676,7,42
npx tsx scripts/check-dwelling.ts 684 4
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

1. `rock-shelter-slab-2026-10-28.md` — 石板形态和材质。`rock-shelter-plan-2026-10-27.md` 是已经认可的内部尺寸。`habitat-stones-2026-10-27.md` 是更早的小卧石，已经停用。  
2. `wrap-grass-rim-flower-mountain-2026-10-27.md`（五问＋阶段）  
3. `coverFocus.ts` + `CoverGrass.tsx` — 脚保留；**pending assemble**（停住也装配）  
4. `rimJoin.ts` + `rimWall.ts` + CDLOD `uOutlineKeep` — 共享岛缘规则  
5. `cover.ts` 花锚点；`rockFolds.ts` 横坡宽凹；`corner.tsx` `SHOW_WATCH_STELE`

## 本轮结论（短）

- **这一轮：** 种子 684 家园 A 的岩窝内部仍是宽 2.34 m、净空 2.11 m，卧位 (−80.8, −105.4)。背板不再是一块平面：两块宽断面、侧壁转角一条斜面、颊侧一个削角。浅色折角来自顶边遮蔽差和顶板侧面叠在背墙上，已去掉，不是用噪声盖住。石面粗糙走法线，进到共用太阳的受光里；没有 roughness 这个量。底色 `#AAA294`。网格 112 三角、1 次绘制。顶板改成一块钝边的板，门边的齿和颊侧的鼓包都去掉了。684 的 A 和种子 42 的 A（净空正好 2.05 m）都重跑了离开—站立—躺下—离开。画面在 `docs/rock-shelter-684/rough-*.png`。GPU **未测**。岩窝细节停在这一档。  
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
4. **下一步：** 岩窝收到「有粗粝感的石板」为止，不再加石头细节。花的可见性仍在后面：先看适宜片区覆盖和已经填满的 144 簇上限，不能只缩间距。鱼、玉化改色、天空、山色不动。岩壁没有染成玉。岸石没改。

## 性能备注

法兰三角约 ×2；花簇上限 144。石头：种子 684 为 16 次绘制、1010 三角，无 LOD。岩窝另计 1 次绘制、112 三角。侧前方中景整帧上一档约 44 次绘制、约 187 万三角，主要是地形；这一处三角更少，整帧没重数。GPU **未测**。
