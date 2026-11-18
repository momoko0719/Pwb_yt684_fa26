# 白玉兽状态栏、溪灵与地图导航：2026-11-15

## 交付范围与复现

本轮保留了工作区原有未提交修改。唯一保留的 Vite 服务是 5184；5181 和 5182 的本项目重复进程已停止。打开 `http://localhost:5184/?islandSeed=684#/atlas/wonderland-terrain`。左侧点 **Creature** 看底部状态栏；右下地图按钮打开小地图，点青点或「Streamling 1/2」直达鱼，点岛面移到该处；设置 → 图鉴 → Creatures → Jade Streamling 查看鱼模型及体力。

## 红队：改前

- 白玉兽的需求数据只在宽大的图鉴正文中，占了过多纵向空间，状态与行为没有游戏中的即时反馈感。
- 溪灵的 `cos/sin` 等半径小圆轨迹与每帧切线朝向，让鱼看起来在原地旋转。模型是几个挤在一起的椭球和硬鳍；图鉴只用 SVG 示意。
- 只有固定 Water 机位，池中 1–3 条鱼不易被找到；此前的 Walk 小地图不能在 Orbit 浏览中用。

## 这轮做了什么

1. `CreatureStatusDock.tsx`：点击岛上白玉兽或左侧 Creature，底部出现同一模型的小肖像、当前行为、目标意图，以及由 `DwellingStats.needs` 读取的饱腹、水分和体力短指标。肖像或「Explore form」进入原有形态图鉴。移走图鉴里重复的长需求条。
2. `streamFish.ts` / `FishSchool.tsx`：从种子记录生成体长、体深、鳞纹条数、尾叉和游速；鱼体改为连续环截面网格，鳍由参数化叶形网格生成，世界实例与图鉴预览共用 `FishBody`。游动沿水流方向的短长轴往返，横向幅度小；转向限速、尾摆放缓。轨迹半径依真实池深向内收缩。
3. `IslandNavigator.tsx`：用实际岛缘画可点击轮廓，标出池、水中生物和白玉兽；地图上的鱼按钮直达对应个体。点岛面时移动镜头，地图收起。图鉴中的鱼定位会优先用最近选中的个体。
4. 图鉴中的溪灵现在有实时 3D 模型样本、行为和体力读数，鱼卡也用同一模型；详情模型可旋转。

## 实际页面验收

固定 1440×900，种子 684 与 42，页面脚本 `node scripts/qa-status-fish-map.mjs` 都没有 page error；分别看到 2 条与 3 条鱼的定位按钮。截图：

- 状态栏：[684](status-fish-map-2026-11-15/status-684.png)、[42](status-fish-map-2026-11-15/status-42.png)
- 地图：[684](status-fish-map-2026-11-15/map-684.png)、[点击岛面后](status-fish-map-2026-11-15/map-relocate-684.png)
- 溪灵直达与游动逐帧：[定位](status-fish-map-2026-11-15/fish-locate-684.png)、[4 秒](status-fish-map-2026-11-15/fish-swim-4s.png)、[8 秒](status-fish-map-2026-11-15/fish-swim-8s.png)
- 图鉴实际模型与体力：[684](status-fish-map-2026-11-15/fish-card-684.png)、[42](status-fish-map-2026-11-15/fish-card-42.png)

`npx tsc --noEmit -p .` 通过。世界检查 `check-world.ts 684,42`、生灵检查 `check-dwelling.ts 684 4` 通过。`check-water.ts 684` 命令退出码为 0，但它在原有跨种子/流量诊断里仍报告 **12 problems**；不能把这说成水系通过。未重测 GPU 时间。

## 红队：改后仍不满意

- 鱼确实不再固定原地画小圆，页面逐帧能看到位移和转向；但体态仍像简化的梭形示意，鳍偏平，面部、鳞纹和玉质层次离用户概念图很远。**鱼的艺术品质未验收通过**。下一阶段应先以一条鱼在大图鉴中做固定正侧、三分之四、俯视造型审核，再把生境材质调到同一标准；不要只加鳍片数量。
- 鱼目前是池中巡游/悬停与体力循环，没有觅食或环境反馈链。形态虽由种子控制，鱼游速和能量有值，仍属于初级 procedural 原型。
- 地图能点击移镜，但只画岛缘、池和生物标记，缺少河道、主要山势和当前镜头足迹；这轮交付的是快速定位，不是 Google Maps 式完整地图。
- 底部状态栏的模型是当前项目的白玉兽标准静态样本，形态编辑预览目前仍未写回岛上个体。不能把它说成 live morphology。

## 下一位 Agent

先读本文件、`docs/streamling-and-needs-review-2026-11-15.md`、`docs/wonderland-handoff.md`，再检查 git status。保留未提交改动。复现命令为 `npx vite --port 5184 --strictPort` 和 `node scripts/qa-status-fish-map.mjs`。先审现有鱼图的鳍、身体过渡、头部与水下对比；鱼的模型与世界共用 `FishBody`，不要重新拆成两套。白玉兽状态栏的需求来自 `DwellingStats`，不能伪造百分比。
