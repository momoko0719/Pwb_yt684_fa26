# Near plants + UI + resource atlas (2026-10-27)

Three small phases. Verify after each, then continue. Fish deferred.

## A — Near plants

### Shrubs
- Keep `growShrubs` distribution; extend plant colour class (patch-seeded 80/15/5: grey-green / ochre / low-sat vermillion) + mild per-plant shade.
- Replace near mesh: main stem → secondary twigs → leaf clusters along twigs, with internal voids. Do **not** densify solid icosahedra.
- LOD by distance (reuse tile buckets): near (~0–28 m) branch mesh; mid (~28–90 m) low-poly volume + colour; far (>90 m) impostor / coarse hull. Only load near geo in the camera ring; mid/far keep mass, colour, outline.
- Files: `shrubs.ts`, `ShrubPatches.tsx`, `palette.ts` (new shrub hues), `check-shrubs.ts` if colour counts needed.

### Grass
Diagnose then fix (wet shore + woodland edge first, same rule elsewhere):
1. Root Y vs displayed terrain (height sample / LOD morph).
2. Rectangular roots / identical bend.
3. Clump shared root + outward fan.
4. Root/soil-moss / blade colour join (shared ground tint, soft contact dark; mild tip↔root hue, no black slabs).
5. Wind: tip-weighted (`t²`); no root slide; avoid identical phase across a clump.

Prefer structure + silhouette + ground join. No global densify, no transparent roots, no per-plant round dirt discs.

## B — Display UI
- Performance (`stats`) default **off**; keep toggle.
- Nav diagnostics stay Dev, default off.
- Replace Zones + Cover suitability with exclusive **环境视图**: Normal / Habitat zones / Grass density.
- Confirm heatmap = soft **density** (`softCoverDensityBytes`), rename accordingly.
- Legend follows mode; Normal = no debug legend.
- No merge of zone × cover data; no generation change.
- Confirm no Leva persistence restores old debug ON (today: none).

## C — Resource atlas + shared sizes
- Wonderland “资源” tab → read-only atlas overlay; close restores island camera.
- Categories: 植被 / 生灵 / 物件 / 地形与水系. One card per generator type.
- Card: name, on-demand thumbnail, config size range. Detail: sample H×W×D (m), rule, variants, island count; rotate / resample seed / locate real instance (no world reseed; empty island → clear message).
- Shared registry (`core/resources` or extend `core/scale.ts`) used by atlas + Scale. Distinguish config range / preview sample / island instance sizes.
- Unified 1 m ruler + optional 1.7 m person. Camera may fit frame; ruler must stay honest.
- One detail WebGL preview (on select); thumbs offscreen / demand; dispose on close.
- Prefer existing R3F / prop / grass / shrub builders. Do not break Penglai shared paths.

## Checks
```
npx tsc --noEmit
npx tsx scripts/check-shrubs.ts
npx tsx scripts/check-world.ts
# Penglai still loads: /#/atlas/island-v1
```
Same-camera before/after: near shrub, grass wet+wood edge, zoom sweep. Report CPU/GPU/draws vs island plant counts. Sync handoff / world-plan §12+ / presentation-notes.
