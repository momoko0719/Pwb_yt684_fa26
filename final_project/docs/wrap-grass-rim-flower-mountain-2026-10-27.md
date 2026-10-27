# 本轮报告：草显示 · 岛缘 · 近景花 · 山形配色（2026-10-27）

计划：`wrap-grass-rim-flower-mountain-plan-2026-10-27.md`。  
验证标记：**脚本**／**已目视（部分）**／**尚未验证**。

弃用方案：按山顶／山腰／山脚分三色；「附近唯一合法饮水站」。  
不做：鱼、建筑、新树种、复杂季节；不改山体布局、水流、生灵规则、灌木形体与黄绿配色。

---

## 普通中文五问

### 1. 我打开后会看到什么变化？

- 近地停住后，草会自己装配出来，不必再滚一下滚轮。
- 只转头（抬头／望远山）时，脚边草不应整片卸掉。
- 岛缘顶面与侧壁用共享 `RIM_JOIN` 规则重叠；外侧看缘时天空裂缝应明显减轻；法兰不再做成整圈又亮又平的「夹层」感。
- 湿岸／林缘／开敞草岛近景更容易看到小花簇（浅藕瓣＋赭心＋灰绿茎）。
- 山体仍以温白为主；部分宽凹面带灰橄榄／浅灰褐，不是帽子／腰带／山脚环。
- 隐藏石碑不再挡路（资产保留）。

### 2. 原问题的实际原因是什么？

| 问题 | 原因（已区分） |
|---|---|
| 停住后草要再 scroll | 装配只在 retention／prefetch **移动**时触发；停住后 `wantKey` 已变但 `lastAssembledKey` 未写 → 等相机 change（滚轮）才 assemble。**不是**单纯「加载慢」 |
| 转头草消失 | 上轮已查：保留中心曾绑视线命中；本轮保留该修复 |
| 岛缘见天空 | 顶皮 discard 缘在壁内 ~0.6 m；法兰与顶皮边界规则未共享；法兰法线偏「上」读成亮白条。CPU 高度一致**不能**证明渲染无缝 |
| 花难遇 | 上限／间距偏紧，适宜片区覆盖不足；尺寸偏矮易埋草里——不是「完全没生成」 |
| 山色 | 勿用高度分带；需宽凹面＋大尺度 gate |

### 3. 你修正了哪个系统关系？

| 链 | 修正 |
|---|---|
| 草花 | `near` 且 `lastAssembledKey !== wantKey` → **自动 assemble**；`assembleGen` 丢弃过期任务；visibility 近距 lerp 0.35；保留＝相机脚 |
| 地形岛缘 | 抽出 `rimJoin.ts`；顶皮 `uOutlineKeep` 与法兰 `flangeSolid`／`flangeInsetMax` 同源；法兰中点加密；法线更靠崖 |
| 山色 | `rockFolds` 增加 basin 尺度写入 A 通道；shader 用宽凹＋gate，合并旧 fold，避免叠暗 |
| 障碍 | `SHOW_WATCH_STELE=false` 时 `cornerObstacles` 不含石碑底座 |

### 4. 哪些已经目视确认，哪些仅脚本通过？

| 项 | 状态 |
|---|---|
| 草转头不卸（定点） | **脚本** `probe-grass-focus` |
| 停等自动装配 | **代码路径确认**；页面停等／Walk 去回 **尚未完整目视** |
| 岛缘高度／inset 覆盖 | **脚本** `probe-rim-join` coverOk；四种子瀑布口＋LOD 冻档 **尚未目视收口** |
| 花普通机位数量 | **脚本** `probe-flower-browse`（多数 OK；seed 7 openIsland 仍偏薄） |
| 花颜色／尺寸／遮挡 | 页面 Look at it **部分**（侧栏挡视野）；图鉴一致依赖同一材质函数 |
| 山形配色无分带 | 代码＋overview **部分**；细对照附图 **未完** |
| GPU 帧耗 | **未测** |

### 5. 还有什么未完成？

1. 收起侧栏做：停等草、抬头低头、Walk 去回、连续 Orbit。  
2. 岛缘：684／5676／7／42 外侧近地、瀑布口、连续缩放同机位前后照。  
3. 花：三个普通机位实拍；seed 7 开敞岛可再扩覆盖。  
4. 山色：中景内壁对照「脊白／宽凹染色」。  
5. 下轮可做：梯池小鱼群；松树中远景圆盘轮廓（独立任务）。

---

## 阶段记录

### 阶段 1 — 草

- 文件：`CoverGrass.tsx`（pending assemble、`assembleGen`、vis lerp）、`coverFocus.ts`（脚保留）。  
- 探针：`npx tsx scripts/probe-grass-focus.ts 684 -40 20` → A–D `show=true`。  
- 预算未改为全岛加载。

### 阶段 2 — 岛缘 + 石碑障碍

- 新：`src/core/terrain/rimJoin.ts`。  
- 改：`rimWall.ts`（共享规则、中点加密、崖向法线）、`cdlod.ts`（`uOutlineKeep`）、`Scene.tsx`、`corner.tsx`。  
- 探针：`npx tsx scripts/probe-rim-join.ts 684` → mean inward ~0.65 m，inset 2.05，coverOk。  
- 宽白条：降低法兰「上法线」占比与过亮 occlusion，不用透明／雾遮洞。

### 阶段 3 — 花

- `cover.ts`：`flowerMax` 144，`flowerSep` 4.6，适宜区优先、小簇 2–4 头。  
- `CoverGrass`：`stemH` 0.34／`head` 0.12；`flowers.ts` 浅瓣＋赭心。  
- 探针：`probe-flower-browse.ts`、`probe-flowers.ts`。

### 阶段 4 — 山形配色

- `rockFolds.ts` basin；`cdlod` morphology tint；`palette` `foldWarm`。  
- **弃用**高度三色带。材质序：石底＋风化 → 形态配色 → 湿润／植被 → 玉化。

---

## 修改文件（本轮要点）

| 路径 | 作用 |
|---|---|
| `src/core/terrain/rimJoin.ts` | 共享岛缘边界常量 |
| `src/core/terrain/rimWall.ts` | 法兰＋加密 |
| `src/core/terrain/cdlod.ts` | `uOutlineKeep`＋山形配色 |
| `src/experiments/wonderland-terrain/CoverGrass.tsx` | 自动装配／花尺寸 |
| `src/experiments/wonderland-terrain/cover.ts` | 花锚点覆盖 |
| `src/experiments/wonderland-terrain/rockFolds.ts` | basin 场 |
| `src/experiments/wonderland-terrain/corner.tsx` | 隐藏石碑无障碍 |
| `src/core/shaders/flowers.ts`／`palette.ts` | 花色 |
| `scripts/probe-*.ts` | 草／缘／花探针 |
| `docs/wrap-*-plan|本报告` | 计划与交接 |

---

## 验证命令

```
cd final_project
npx tsc --noEmit -p .
npx tsx scripts/probe-grass-focus.ts 684 -40 20
npx tsx scripts/probe-rim-join.ts 684
npx tsx scripts/probe-flower-browse.ts 684,5676,7,42
npx tsx scripts/probe-flowers.ts 684,5676,7,42
npx vite --port 5180 --strictPort
```

页面：`/#/atlas/wonderland-terrain` · seed **684** · 收侧栏 · Look at it／Island overview。

蓬莱：共用 `cdlod` 的 `uOutlineKeep` 默认来自 `RIM_JOIN`；未改蓬莱布局。**未单独跑蓬莱目视**。

---

## 性能

| 项 | 说明 |
|---|---|
| 花生成 | 全岛上限 144 簇（原 128）；bake 仍在 cover 构建内 |
| 近景花实例 | 随 48 m 圆盘；每簇 2–4 头 |
| 法兰三角 | rim 点数约 ×2（中点）→ 侧壁三角约 ×2 |
| 草装配 | 同预算 chunkBudget 36；过期 gen 丢弃 |
| GPU | **未测** |

---

## 下一位 Agent

1. 读本报告 → 计划 → `wonderland-handoff.md`。  
2. 先跑上表探针，再收侧栏目视未完项。  
3. **不要**恢复高度分带山色；**不要**用扩大 inset／抬法兰试错代替 `RIM_JOIN`。  
4. 下一功能建议：一个梯池里的小鱼群（松树圆盘轮廓另开任务）。
