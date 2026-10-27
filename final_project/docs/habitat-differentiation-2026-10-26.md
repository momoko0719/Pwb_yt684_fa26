# Habitat differentiation — feature table & order (2026-10-26)

Normal browse (Zones / Cover suitability / Scale **off**). Shared white-stone language; no debug-swatch paint.

## 1. Feature table

| Zone (label) | Control factors | Surface (normal view) | Vegetation | Files |
|---|---|---|---|---|
| 水面 water | water mask | water sheet | none | `water.ts`, flow shaders |
| 梯池干台 terrace | lowest plate SDF, non-water; slope reclass → cliff/rockSlope | cream banding, soft rim damp | rare only on wide dry seat away from water | `zones.ts`, `cover.ts` |
| 陡崖 cliff | slope > cliff | cooler rock face | **none** (hard off) | `zones.ts`, `woods.ts` |
| 山脊 ridge | high + local rise | cooler weathering | **none** (hard off) | `zones.ts` |
| 石坡 rockSlope | mid–steep slope | warm-grey face | rare toe / hollow islands | `cover.ts` niches |
| 湿润岸边 wetShore | toWater + gentle | damp stone + soil/moss under patches | continuous grass **sheets** (~1.5 clumps/m² in patch) | `cdlod`, `cover.ts` |
| 林地 woodland | moisture+shelter+noise clumps | needle-litter grey-brown | heart quiet; edge denser | `woods.ts`, `cover.ts` |
| 林缘 | woodland edge / mid grove | litter↔stone / grass↔bare | grass sheets + flowers + bare | grove edge in `cover.ts` |
| 开敞石地 open | default dry reachable | warm white + large weathering | rare moist **grass islands** | low-freq island mask |
| 栖息地 habitat | dry, sheltered, walk of water | no preset tint | sparse islands | jade after dwelling |

## 2. Terrace classification (confirmed)

**Before:** `onTerrace` (lowest plate SDF < 0) labelled **all** non-water cells inside the plate as terrace — including steep weir faces.

**Fix:** On terrace footprint, reclass by slope → cliff / rockSlope / terrace (dry seat). Label → **梯池干台** (`zones.terrace` EN/中).

## 3. Implementation order

1. Docs (this file) + rename + terrace slope reclass  
2. Always bind zone (+ moisture); live surface shading when debug off  
3. Cover: clumps/m² mapping; denser **inside** patches; suitAt nearest-cell gate  
4. Flowers: world-baked sites only; no camera dens-peak invent  
5. Jade vs wet/soil separation in terrain shader  
6. Sample-plot probe `scripts/probe-cover-habitats.ts`; QA `scripts/qa-screenshots.mjs`  

## 4. Density units (cover) — updated 2026-10-26

- `suit` ∈ [0,1]: growth condition × amount  
- `patch` ∈ [0,1]: soft mask for vegetation patches / islands  
- `density = suit × (0.12+0.88×patch)`: far tint + flowers  
- Near: **`clumpsPerM2 (2.0) × soft(patch) × soft(suit)`** with `clumpCell=0.72` — patch coverage and interior density are separate  
- Hard off: outside / water / cliff / ridge. Terrace & rockSlope use niches, not a blanket ban  

See **`habitat-visible-2026-10-26.md`** for the sparse-screenshot diagnosis and Look-at buttons.

## 5. World consistency

Flower and grass roots = `(seed, x, z, cover field)` only. Camera changes load radius / LOD only. Habitat Look-at and flower Look-at only move the camera.

## 6. Sample plots (seed 684, ±12 m) — after denser patches

Command: `npx tsx scripts/probe-cover-habitats.ts` → `scripts/out/habitat-plots-684.json`.

| Plot | Suit m² | Patch m² | Clumps/patch m² | Blades in plot | Notes |
|---|---|---|---|---|---|
| wetShore | 120 | 104 | **1.51** | 1881 | Sheet target met |
| woodlandEdge | 244 | 236 | **1.51** | 4256 | Edge grass + litter |
| openIsland | 244 | 212 | **1.46** | 3693 | Moist island, not absolute bare |

Mean blades/clump ≈ 12. Island flower anchors = 48.
