# Wonderland — hand-off

**LATEST (2026-11-15, needs + streamling prototype):** Read `docs/streamling-and-needs-review-2026-11-15.md` and inspect `docs/streamling-pass-2026-11-15/` actual page captures. White beast hunger/thirst/energy now drive drink/eat/rest decisions; panel shows live bars and grass biomass. A seeded 1–3 fish prototype is in the plunge pool, Water tab approaches it, world click opens the same atlas. Four seeds pass world and fish depth checks; 684 world fish click verified; 42 catalog checked. **Visual acceptance remains partial:** drinking shoulder still bulky, rest pose still awkward, fish silhouette/simple loop motion not final, fish diagram is not a 3D offscreen render. Read the report's red-team sections before continuing. Reproduce from `final_project` with `npx vite --port 5184 --strictPort`, open `http://localhost:5184/?islandSeed=684#/atlas/wonderland-terrain`, choose Water, click a fish; Settings → Meet the creature shows live needs. `node scripts/run-ts-check.mjs scripts/check-world.ts 684,5676,7,42` and `check-dwelling.ts 684 4` pass. `check-water.ts` still prints 12 known problems. Preserve all uncommitted changes; do not reset.

**LATEST (2026-11-15, grazing and water-creature proposal):** Read `docs/grazing-and-water-creature-2026-11-15.md` and screenshots/data in `docs/grazing-pass-2026-11-14/` and `docs/grazing-pass-2026-11-15/`. Fixed detached nostril/mouth meshes in the drinking head rig. A single seeded grazing patch now has actual `eat` activity, mouth proximity check, blade and terrain cover depletion, and time-based recovery; 684/42/7/5676 all reached and ate, with screenshot before/after at the same camera. This is **not** a complete hunger/thirst ecology; the eat visit still follows the drink behavior sequence, and the visual grazing signal is mild at regular distance. Resting feet remain visually unsatisfactory after trying and reverting a floating-torso variant. Proposed a small procedural aquatic creature, but it is **research/design only** pending owner review. Preserve all uncommitted work. Local dev server used port 5182; run `npx vite --port 5182 --strictPort`, open `http://localhost:5182/?islandSeed=684#/atlas/wonderland-terrain`, choose Creature. `tsx` was unavailable locally; world/dwelling/water checks were bundled with installed `rolldown` then run with Node. `tsc` and world four seeds and dwelling four cycles pass; water still prints 12 known problems. Next: design a real rest fold/skin, strengthen grazing legibility without a fake decal, then connect hunger/thirst thresholds and multiple pasture cells. Aquatic creature requires owner approval of the proposal first.

**LATEST (2026-11-14, posture and needs review):** Read `docs/creature-posture-and-needs-plan-2026-11-14.md` and the actual before/after page captures in `docs/creature-posture-2026-11-14/`. Resting jaw swelling improved by preserving sculpt muzzle calibration; low throat vertices no longer inherit as much skull rotation. The visual rig now has lower-neck, upper-neck and skull pivots, and neck reach stretches lengthwise, but the **drinking silhouette remains visibly awkward**. Do not mark it accepted. An attempted shorter simulation neck made seed 42 lose all drinking stands; an attempted taller sculpt failed crown-height constraints; an attempted lower drinking torso changed the habitat and over-compressed forelegs. All three experiments were reverted. Default cursor is now a rounded arrow with a small jade leaf, but OS cursor appearance still needs manual review. A hunger/thirst/grazing/regrowth design and its sources are in the review doc; it is a proposal, not implemented. Preserve prior uncommitted changes.

**LATEST (2026-11-14, Equilinox and two-site jade pass):** Read `docs/equilinox-precedent-and-jade-pass-2026-11-14.md` and its actual page captures in `docs/equilinox-pass-2026-11-14/` before further work. Owner approved the **water reveals jade** pilot. This pass studied official Equilinox/ThinMatrix sources, added an independently adjustable body-depth axis to the atlas preview, refined shoulder/nostril/mouth geometry, replaced ambiguous cursors with themed arrow states and hover action labels, and placed two jade exposure studies at generated pool-outlet and downstream-bend sites. The live island beast **does not yet respond to atlas morph edits**, and the downstream jade study is **not visually accepted**; do not claim these are complete. `tsc`, 3000 morph combinations, world 684/42, and four dwelling loops pass. `check-water.ts` still prints 12 known problems. Browser 684/42 and Penglai rendered without page errors; GPU timing and human visual approval remain open. Run `npx vite --port 5181 --strictPort` from `final_project`, open `http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain`, use Water view and click the beast. Preserve all existing uncommitted work.

**LATEST (2026-11-14, owner feedback pass):** Read `docs/white-jade-2026-11-14-review.md` first. The drinking-mark visitor toggle was removed. The generated neck now rises more upright; 1000 morph samples pass the 2 m crown envelope, but the shoulder wedge/face/mane remain unfinished. Shelter palette and seeded roof crown were adjusted; four-seed route/headroom probe passes, yet the shelter still visibly looks like a constructed slab. The island has custom cursors and actual world clicks to Jade Dweller, Pine, and Pool cards (shrub path wired but not separately clicked in QA). Zoom investigation found camera and pivot were being corrected separately, plus repeated near-grass builds. Both were adjusted, but human-visible jitter and GPU timing remain unverified; the headless 90-wheel trace had 5 grass rebuilds vs 12 before, while p95 stayed ~73 ms. **Do not implement the water–jade proposal until owner chooses a direction.** The report contains three research-grounded options and concrete game precedents. Reproduce with `npx vite --port 5181 --strictPort` from `final_project`; open `http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain`, click Creature/Water cameras, hover/click the beast, pine, and pool. Run `node scripts/run-ts-check.mjs scripts/check-morph-rework.ts`, `probe-rock-shelter.ts 684,5676,7,42`, `check-world.ts 684,5676,7,42`, `check-dwelling.ts 684 4`, and `check-water.ts` (12 known problems). `node scripts/qa-current-zoom.mjs` needs localhost browser access. Preserve **all** prior uncommitted work; do not reset the tree.

**LATEST (2026-11-11, creature surface review):** Read `docs/art-direction-2026-11-09/creature-surface-stage4/review.md` and inspect its actual four-angle and rest/walk/drink screenshots before touching the creature. The owner approved the rig; this pass redesigned the generated surface without changing the rig or life rules. Red-team result: smoother body and more legible ears/hooves, but facial identity, mane, tail tip and close material still fail the approved concept target. A rejected flat side-plate experiment was removed. Do not call Stage 4 art complete, do not proceed to birds/fish, and do not replace the procedural system with one static asset. Keep all uncommitted work.

**LATEST user-review fix (2026-11-10):** Stage 1 rig now has an actual review entry. Read `docs/art-direction-2026-11-09/creature-rig-stage1/review.md`, especially its first follow-up section, and inspect `creature-rig-stage1/user-review-fix/atlas-skeleton.png`, `island-skeleton.png`, and `poses/walk.png` / `poses/drink.png`. In browser: Settings → Meet the creature → View skeleton (drag to rotate); Show live skeleton on island opens only the live rig and chooses Creature camera. English detail note is localized. Generated neck rest angle was lowered; this is still a rough structural prototype. Do not proceed to detailed sculpt or topology variations before owner reviews the visible rig. Preserve all uncommitted changes.

**LATEST (2026-11-10, creature rig stage 1 awaiting visual review):** Read `art-direction-2026-11-09/creature-rig-stage1/review.md` first, then `art-direction-2026-11-09/white-jade-procedural-creature-architecture-v3.md`. The owner supplied five DESIGN 6197/4197 slides and confirmed the beast must remain procedural. The current atlas and island now use a shared `SkinnedMesh` with root/neck/head/four two-part leg bones, and horns/eyes/mane/hooves attached to appropriate bones. The old destructive per-vertex neck warp is removed from the active path. Fixed-state browser screenshots of rest, walk and full drink are in `creature-rig-stage1/`, with tests and performance numbers in its report. This is a **structural prototype**, still far from the approved sculptural concept. The island uses the existing BODY simulation and hard-coded seed 11 birth form; the three atlas sliders still change the preview only. Do not start random horn topology or detail materials until the owner reviews the rig/poses. Life camera rotation retains follow; loading shows stage-based percentage. Preserve all uncommitted work. Older CURRENT/stage notes below are historical and do not describe the latest code.

**2026-11-10 atmosphere stage (awaiting owner review):** Read `art-direction-2026-11-09/atmosphere-stage-review-2026-11-10.md`, then `art-direction-2026-11-09/procedural-white-jade-beast-v2.md` and `art-direction-2026-11-09/implementation-plan.md`. White Jade's running overview now fades the cloud plane into the real sky, adds three seeded cloud banks and three small circling birds. Before/after four-seed screenshots and an eight-second motion clip are in `art-direction-2026-11-09/atmosphere-before/` and `atmosphere-final/`. Local preview: `http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain`. `tsc` and four-seed world checks pass; water still reports 12 pre-existing problems, and GPU time is unmeasured. The owner has approved the procedural creature **design**, but no creature morph generator has been coded. Await atmosphere review before starting its prototype. Preserve all uncommitted work.

Plan: `wonderland-world-plan.md`. Show: `presentation-notes.md`.  
**最新交接（2026-11-08，White Jade UI 验收）：** 先读 `ui-qa-2026-11-08/report.md`（九节逐项状态、前后截图、三状态 Life 视频、检查结果），再读 `ui-structure-2026-11-08.md`、`Exhibit.tsx`、`Scene.tsx`、`CoverGrass.tsx`、`ResourceAtlas.tsx`、`creature.tsx`。从 `final_project` 运行 `npx vite --port 5181 --strictPort`，打开 `http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain`；换成 5676、7、42 可复现其他总览。左侧现为四镜头；总览按实际网格、岛底与落水取景；Life 实时目标飞行并预热近景草；设置五组排序、课堂路径总开关、模型图鉴与加载失败重试均已页面拍摄。`npx tsc --noEmit -p .`、世界四种子、生灵四趟、岩窝四种子通过。`check-water.ts` 虽退出码 0，却输出 **12 个问题**，因此水系验收未通过；此轮遵照用户要求没有改水。GPU 时间、触屏及其他种子的 Life 长时间跟随未测。本轮工作未提交，保留所有原有未提交文件。  
**上一轮交接（已被上述验收更新）：** 当时总览取景仍裁岛，四种子截图和 Life 三状态录屏尚未收齐。本轮的实际页面结果以新报告为准。  
**上一档：** 岩窝顶板收成一块钝边的板，门边的齿和颊侧鼓包去掉了。记录在 `rock-shelter-slab-2026-10-28.md` 末节。内部净空、卧姿和进出没改。岸石保持。家和饮水站没挪。山色仍是 `fold-tint-simplify-2026-10-27.md`（默认强度 1）。只撤更早的石头步时用 `habitat-stones-2026-10-27.md` 里的 `git checkout`，不要 `git reset --hard`。多生灵可以共用接触累积，但当前这张图的覆盖范围还要单独设计，见 `living-island-next-plan.md` 第 6 节。  
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
npx tsx scripts/probe-creature-readout.ts 684,42
```

`/#/atlas/wonderland-terrain` · seed **684**. 收起 Leva 侧栏再目视。  
Look at it → 近草／花；Island overview → 岛缘／山色。

## Read order

1. `ui-structure-2026-11-08.md` — 设置分层和每一项去了哪里。`ui-revision-plan-2026-11-08.md` 是更早的一版方案。`creature-debug-round-2026-11-07.md` 是调试数据流。  
2. `rock-shelter-slab-2026-10-28.md` — 石板形态和材质。`rock-shelter-plan-2026-10-27.md` 是已经认可的内部尺寸。`habitat-stones-2026-10-27.md` 是更早的小卧石，已经停用。  
3. `wrap-grass-rim-flower-mountain-2026-10-27.md`（五问＋阶段）  
4. `coverFocus.ts` + `CoverGrass.tsx` — 脚保留；**pending assemble**（停住也装配）  
5. `rimJoin.ts` + `rimWall.ts` + CDLOD `uOutlineKeep` — 共享岛缘规则  
6. `cover.ts` 花锚点；`rockFolds.ts` 横坡宽凹；`corner.tsx` `SHOW_WATCH_STELE`

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

## Page chrome (2026-11-07, revised the same day)

The island page is an exhibit (`Exhibit.tsx`, `JADE_UI`). A full-island overview opens first; five illustrated camera bookmarks remain at left. One gear opens a custom settings panel containing exploration, appearance, island, advanced shaping, and three grouped creature diagnostics. The Leva hooks still hold the same simulation values but their panel is hidden on this page; there is no separate simple/studio mode. Creature diagnostics default off. The creature can be clicked directly to open its card. The other islands still use Leva. Build and visual check on 2026-11-08 passed at 1280×720 in English and Chinese. Record of the earlier creature implementation: `creature-debug-round-2026-11-07.md`.
## Current creature review (2026-11-11)

Latest owner review and red-team result: read `docs/art-direction-2026-11-09/creature-neck-tail-panel-redteam-2026-11-11.md` first. The rest neck is more upright, the tail is a continuous raised curve, and the creature detail is a large rotatable model on the left with all morphology controls visible on the right at 1440px and 900px widths. The user still needs to review these actual screenshots. This is **not** final character art: the chest/neck makes a sharp wedge, face/mane/material remain far from the concept, and drinking forelegs still crowd the neck. The island creature is unchanged by atlas sliders. Next: sculpt one continuous base skin bound to the accepted rig, review fixed side/front/top/drink images, then add attached carved mane flow and per-instance morphology. Preserve all unrelated uncommitted changes and the existing life rules.

Read `docs/art-direction-2026-11-09/creature-drink-and-variation-review-2026-11-11.md` first, then `docs/art-direction-2026-11-09/white-jade-procedural-creature-architecture-v3.md`. The owner approved the shared skeleton but rejected the drinking head and the low fidelity surface. This round joined head to neck, used the real mouth target for a two-bone pose, and added explicit single/paired horn and branch controls in the atlas preview. Browser screenshots show the head no longer detaches, but the drinking forelegs overlap the neck, and the sculpt still falls short of the concept. The atlas variations are **preview only**; the island instance still uses fixed birth values. Next: sculpt one coherent face, neck and shoulder skin, review the drinking silhouette at fixed angles, then connect per-creature genome to the actual island and simulation. Do not present the preview as live editing. See the review for screenshots, failed water diagnostic and reproduction commands. Keep every existing uncommitted change.

## Previous atmosphere stage: rejected (2026-11-10)

Read `docs/art-direction-2026-11-09/handoff-to-next-ai-2026-11-10.md` first. The owner rejected both the previous 2D sprites and the later 3D metaball clouds as ugly; the latter appears as smooth capsules and loops. **Stage 2 is not approved.** The handoff preserves the owner's rejected screenshot, approved concept target, current code paths, recovery and review steps, and Stage 3–5 plan. Do not start creature morphology. Preserve all unrelated uncommitted work.

## Creature neck (2026-11-15)

Owner: the neck looked wrong lying and drinking; make it a quadruped's (horse, sheep). Fixed in three places:
- `creatureMorph.ts`: the sculpt's neck from the withers forward and up at ~41° (was ~72°, near
  upright), longer (0.70–0.76 sculpt units; shorter, seeds 7 and 42 found no drinking stand), its top
  line arched; the face sloping down (−0.62 rad) instead of turned up.
- `dwelling.ts`: `BODY.shoulder`, `head.at`, `head.front`, `neckUp` now come from the sculpt (`SCULPT`):
  the sim's shoulder had been 0.33 m below the sculpt's and its neck 0.27 m longer, and the drawing
  stretched the neck to make up for it. The face's angle follows the neck (`head.level`, `head.offset`):
  as sculpted standing, −1.25 rad with the neck bowed to −1 (−1.45 tucked the chin). Lying, the neck
  0.2 rad above standing (lower, it reached forward like a goose's).
- `creatureRig.ts` `poseRiggedCreature`: at rest the sculpt turned by the sim's neck change; drinking or
  grazing, rigid neck pieces bent upward (an arched top line, not a trunk under the chest), no bone
  stretching. `creature.tsx` no longer offsets the mouth to fit the old body.

Checks: `check-world` 684/7/42 all hold (drink + 3 homes each); `check-dwelling 684`: 0 off ground or in
water, slip 0.0 cm, muzzle 0.0 cm off the water; `check-morph-rework`: 0 faults. Shots:
`shots/creature-neck-drink.jpg`, `shots/creature-neck-rest.jpg`. Walking side view not captured.

Follow-up (same day, owner): a block under the chin and whisker-like lines. Both came from the slope
change above: `creatureMorphMesh.ts` laid the cheek, jaw, muzzle, brows, eyes, nostrils and mouth seams
out by plain x/y offsets for a level face, so the jaw hung below the chin and the mouth seams stood off
the face. Now `faceFrame` lays the face out level and turns it with the face about the head's base.
Also nearer the concept (a deer or qilin, not a horse): face shorter (0.22–0.26) and only a little down
(−0.36 rad), jaw and muzzle slimmer, the neck rising steeply (~68° at the root) and curving forward.
Checks: `check-world` 684/7/42 all hold; `check-morph-rework` 0 faults, crown 1.73 m.
Shot: `shots/creature-face-neck-2026-11-15.png` (lying, drinking, standing; two sides each).

## 2026-11-16 — life cards, island map, fish form, atlas fish entry

See `docs/life-ui-map-habitat-plan-2026-11-16.md` (precedents, Sims brainstorm, results). New files:
`LifeCard.tsx` (shared needs card), `FishFamily.tsx` (seed-family strip). `IslandNavigator.tsx`
rewritten (relief map from the height grid, clickable life marks). `StreamFishData.scaleBands` replaced
by `marks`; fish length 0.45–0.75 m. Palette: `JADE_UI.need*`, `JADE_UI.map*`, `PORCELAIN.fish*`.
Next round: the habitat grown by rule (lo-fi options first).
