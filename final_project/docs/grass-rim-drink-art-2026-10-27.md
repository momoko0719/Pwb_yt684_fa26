# 本轮报告：近草稳定 → 岛缘／饮水 → 小美术（2026-10-27）

计划：`grass-rim-drink-art-plan-2026-10-27.md`。  
验证：**脚本**／**已目视**／**尚未验证**。不加新物种、不扩图鉴、不改灌木形体。

---

## 生效参数（读自代码，非旧文档）

来源：`coverFocus.ts`、`CoverGrass.tsx`（本轮改后）。

| 项 | 当前值 |
|---|---|
| 加载中心（保留） | Orbit＝**相机脚下** XZ；Walk＝相机＋前望 6 m |
| 预加载 | 视线命中，水平距 ≤ `prefetchMax` **88 m**；环 `prefetchRing` 1 |
| 加载／卸载 | `loadOn` **72**／`loadOff` **105**（对 **cam→脚** orbit-range） |
| 全局渐隐 `uVisibility` | `fadeOn` **48**／`fadeOff` **98**（同样跟 cam→脚，**不跟** look-hit） |
| 叶渐隐 | `fadeNear` **42**／`fadeFar` **78**（相机→叶） |
| 装配 | 保留环 `chunkRing` 2（5×5×24 m）；`chunkBudget` **36**；叶片硬裁 `radius` **48 m**（仅绕保留中心） |
| 缓存 | `cacheMax` 48；`refocus` 16 m |
| 剔除 | 实例网格 `frustumCulled={false}`；叶 discard＝距离 dither×visibility |

---

## 一、草随视角消失

### 1. 原来为什么发生？如何确认？

**原因（已区分）：**

| 类型 | 是否主因 |
|---|---|
| **卸载／重组错中心** | **是**：Orbit 曾把装配圆盘绑在**视线命中点**；转头命中跑远 → 近草整块出 48 m 圆盘被卸掉 |
| **透明淡出** | **是（加剧）**：`uVisibility` 曾跟 look-hit 距离；抬头／望远山 → 全局淡出，脚边草一起没 |
| 包围盒剔除 | 否（已关 frustumCulled） |
| 叶片背面 | 次要；非整块消失 |

**固定片（seed 684）：** 世界坐标约 (−40, 20)，chunk **`-2,0`**（`probe-grass-focus.ts`）。

脚本场景：同机位看脚／抬头／望远山／再低头 → `near=true`、`show=true`；仅 Orbit 拉远到圆盘外才不显示。

### 2. 改了什么？

- `coverFocus.ts`：保留＝相机脚；look 只 prefetch；load／fade 用 cam→脚。
- `CoverGrass.tsx`：装配以保留中心硬裁；prefetch 环进预算；转头不因 look 卸载。

### 3. 实际看到了什么？

- **脚本：** 定点转头不应卸载（见上表）。
- **页面：** seed 684「Look at it」近地可见草丛／赭黄灌丛；侧栏挡视线，Orbit 连转全验收 **未完全走完**。

### 4. 还有什么没验证？

Walk 去回同片草；抬头低头完整目视对照；Performance 面板里 focus／chunk 实况。

复现：`npx tsx scripts/probe-grass-focus.ts 684 -40 20`；页面 seed 684 → Look at it → 只转视角。

---

## 二、岛缘验收 + 饮水岸线

### 岛缘

1. **原因（上轮）：** 顶皮 discard 在壁内 ~0.6 m；底 STRIDE 曾为 2。法兰 inset **1.35 m**、STRIDE=1。
2. **本轮：** 几何未再改；`probe-rim-join` 确认高度同源、内凹 0.6–0.7 m。
3. **目视：** overview 有缘，侧栏遮挡；瀑布口／多 LOD／5676·7·42 外侧近地 **尚未完整目视**。
4. **未验证：** 台阶／闪烁细查；四种子瀑布口。

### 饮水（真实岸线）

撤回「附近唯一合法站」的绝对表述。新脚本：`probe-drink-shore.ts`。

**搜索：** 家→当前饮水直线距＋8 m；岸带 `toWater∈[0.8,14]` 且有湿邻／梯度；粗间距 2 m，失败则邻格加密 1 m。

#### Seed 5676 · 家 A (−85, −41) · 饮水 (−104.1, −47.4)

搜索半径 **28.2 m**；岸缘候选 **172**；实际检查 **15** 段。

| 岸段／坐标 | 距家直线 | 可行路线 | 脚干稳 | 嘴触水 | 原候选 | 失败步骤 |
|---|---|---|---|---|---|---|
| CURRENT (−104.1, −47.4) | 20.2 | 21.5 | yes | yes | yes | 配对胜出 |
| (−85.0, −41.0)…(−103,−45) 等 14 段 | 0–19 | — | 未检查* | no | no | **嘴点无有效水面**（脚未跑） |
| (−83.0, −37.0)·密 | 4.5 | — | 未检查 | no | no | 嘴点无有效水面 |

\* 嘴失败时脚标「未检查」，不写 no。

一句中文：在家到饮水距离内的真实岸缘上，抽到的更近段都在**嘴触水**这一步失败；当前站仍合法。限于本采样，不称唯一。

#### Seed 684 · 家 A (−83, −105) · 饮水 (−72.1, −45.4)

搜索半径 **68.6 m**；候选 **591**；检查 **15** 段（含中距与近饮水岸）。更近段均 **嘴点无有效水面**；未改选址规则。

评分权重：站位 −2×坡＋梯田外+0.5＋脚干；家 栖息地+2＋3×遮蔽−10×坡−距/200；配对不含回家路径长。

---

## 三、小美术

### 灌木配色（形体未改）

目标权重：暖灰橄榄 30%／赭黄 65%／暗铁红 5%（`SHRUB_TONE_WEIGHTS`）。

| 种子 | 片区 | 株数 | 橄榄片区／株 | 赭黄片区／株 | 铁红片区／株 |
|---|---|---|---|---|---|
| 684 | 36 | 1101 | 15／434（39%） | 21／667（61%） | 0／0 |
| 5676 | 30 | 864 | 12／381（44%） | 15／431（50%） | 3／52（6%） |
| 7 | 40 | 1363 | 10／345（25%） | 29／988（73%） | 1／30（2%） |
| 42 | 36 | 1114 | 10／280（25%） | 25／785（71%） | 1／49（4%） |

概率≠精确比例。同机位：Look at it 前景可见偏赭灌丛（684）。

### 石碑

`SHOW_WATCH_STELE=false`：场景隐藏碑＋底座；资产／图鉴预览保留；定位 count=0、locate=null；障碍仍留石座 footprint，避免路线突变。

### 孤松

`woods.ts`：chance 0.45→0.28；ledge 更严；拒尖顶（邻域抬升／支撑环）。现 lone：684→3，5676→3，7→2，42→6。尖峰目视对比 **部分**。

---

## 修改文件

| 文件 | 作用 |
|---|---|
| `coverFocus.ts` | 相机脚保留＋look prefetch |
| `CoverGrass.tsx` | 装配／预算／统计 |
| `shrubs.ts` | 配色权重 |
| `woods.ts` | 孤松岩肩优先 |
| `corner.tsx` | 隐藏石碑 |
| `Scene.tsx` | 石碑定位关闭 |
| `resourceCatalog.ts` / `ResourceAtlas.tsx` | 文案／色名 |
| `scripts/probe-grass-focus.ts` | 转头诊断 |
| `scripts/probe-drink-shore.ts` | 真岸线饮水表 |
| `scripts/probe-lone-pines.ts` | 孤松计数 |
| 本报告 + plan + `wonderland-handoff.md` | |

## 验证命令

```
cd final_project
npx vite --port 5180 --strictPort
npx tsc --noEmit -p .
npx tsx scripts/probe-grass-focus.ts 684 -40 20
npx tsx scripts/probe-drink-shore.ts 5676
npx tsx scripts/probe-drink-shore.ts 684
npx tsx scripts/probe-shrub-tones.ts 684,5676,7,42
npx tsx scripts/probe-lone-pines.ts 684,5676,7,42
npx tsx scripts/probe-rim-join.ts 684
```

## 剩余

1. 草：Walk／连转完整目视（收起侧栏）。  
2. 岛缘：四种子瀑布口＋LOD。  
3. 孤松尖峰前后同机位。  
4. Fish — later。
