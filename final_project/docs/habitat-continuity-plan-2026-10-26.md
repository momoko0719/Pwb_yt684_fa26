# Habitat continuity — plan (2026-10-26)

**Goal:** Continuous habitat read in free Orbit/Walk browse. Keep deterministic generation. Do **not** solve by more blades or Look-at-only demos. No multi-creature / buildings / new trees this pass.

## Must-read files

| File | Why |
|---|---|
| `CoverGrass.tsx` | Near stream focus, chunks, assemble |
| `cover.ts` | suit / patch / density rules |
| `cdlod.ts` | Far/mid terrain cover + wet/litter mixes |
| `surfaceBlend.ts` | Soft zone weights |
| `Scene.tsx` | Walk flag into CoverGrass |
| `island-v1/Scene.tsx` | Penglai `lookedAt` + near-only blades (`GRASS_VIEW`) |
| `scripts/probe-cover-focus.ts` | Evidence for overview miss |

## Current failure (confirmed)

- Focus = `camera.xz + lookAhead×horizontal(look)` always.
- High Orbit off-island → focus in sea/`outside` → **0 near blades** while view shows the island.
- Far tint exists (`softCoverDensityBytes`) but mid has little “thickness” once blades are absent.
- Wet shore can still read as a soft grey-cyan band (zone-weight driven) more than structured shore.

## Implementation order

### 1. Load centre (Orbit vs Walk)

- **Walk:** camera + forward look-ahead (keep).
- **Orbit:** Penglai-style ray march to height-map hit; load around that ground point.
- Miss / off-land: **hold last stable focus** (no jump); near blades off until a good hit returns.
- When camera-to-hit distance > ~55 m: **no near blades** (overview = far tint only).
- Keep chunk cache, world-seeded clumps, `cacheMax`.

### 2. Far / mid / near

| Band | Expression | Cost |
|---|---|---|
| Far | Existing cover density texture on terrain (strengthen patch read, no fake meadow on bare stone) | Already |
| Mid | Stronger soil/moss carpet + edge falloff in terrain shader when density real; **no** full-island instances | Shader only |
| Near | Existing blade/flower chunks when close to ground focus | Cap via view distance |

Reuse Penglai pattern: meadow/cover on terrain always; blades only when close.

### 3. Wet shore structure

- Bias suit/soil by slope, `toWater`, hollow (already partly in `cover.ts`); tune for continuous low grass on gentle concave banks, bare wet stone on steep.
- Terrain: wet stone vs soil/moss from moisture×cover, not equal-width zone ribbon; no per-clump circular dirt stamps.
- Jade vs wet: keep separate (wear jade vs moisture damp).

### 4. Zone hard cuts

- Debug labels stay discrete.
- Near sampling: keep hard exclude only outside/water/cliff/ridge; soft suit/patch across wood/open/wet.
- Surface weights: continuous moisture/grove; do **not** widen `SURFACE_BLEND_M` further.
- Do **not** raise global `amount`.

## Acceptance

1. Overview (off-island): far patch organisation visible; near blade count ~0 or not required.
2. Orbit zoom to a wet shore (not via Look-at): mid carpet + then near blades appear without a hard circular pop if possible; focus on visible ground.
3. Free pan to a second wet shore: same behaviour.
4. Debug layers OFF for visual claims.
5. Report: island generate vs loaded vs drawn; build ms; CPU measured / GPU 未测 if needed.

## Status

Probe acceptance for load centre: **met** (`cover-focus-684-continuity.json`).  
Owner GPU visual acceptance: **pending** — see `habitat-continuity-2026-10-26.md` §6.

## Out of scope

Multi-creature, new buildings, new tree species, global density crank.
