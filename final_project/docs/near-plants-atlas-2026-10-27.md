# Near plants + UI + resource atlas — report (2026-10-27)

Plan: `near-plants-atlas-plan-2026-10-27.md`. Fish deferred.

## 1. Shrubs — structure, colour, cost

**Near (≤28 m, hysteresis ±8 m)**  
Main stem + 4–5 primary branches + secondary twigs; leaf **sprays** = thin diamond quads along twigs with gaps (nandina / spiraea–like, labelled artistic). Not densified icosahedra.

**Mid (28–90 m)**  
Fewer twigs, coarser sprays — volume, colour, outline.

**Far (>90 m)**  
Stub stem + tip sprays — silhouette only.

**Colour**  
Patch-seeded tone 80 / 15 / 5: grey-green (`shrub`/`shrubShade`) · ochre · low-sat vermillion. Mild per-plant shade. Distribution unchanged (`growShrubs`).

**Cost**  
~1.1k plants stay mid/far; only plants near the camera use the branch mesh. LOD mirrors pine (`useFrame` bucket + hysteresis). Seed 684: 36 patches / 1103 plants (check-shrubs). Overview triangles previously ~1.26 M with all near-equivalent meshes; near detail now local — expect fewer high-detail draws when camera is high.

Files: `shrubs.ts`, `ShrubPatches.tsx`, `palette.ts`.

## 2. Grass — cardboard diagnosis + fixes

| Check | Finding | Fix |
|---|---|---|
| Root vs terrain | Blade Y from height grid; CDLOD morph can float ~cm | Shared clump Y − 0.02 m; shader root sink −0.04×h (was −0.08×h tip bias) |
| Rectangular roots / same bend | Flat strip, wide at root; lean only from `aShape.z` | Width mid-bulge + narrow planted root; 5 segments |
| Clump structure | Blades scattered in disc, each own ground Y | Shared root; short basal leaves; taller blades face outward |
| Root / soil join | Uniform meadow albedo | Tip cooler-green, root warmer toward soil; soft contact dark (not black slab) |
| Wind lock-step / root slide | `t²` already rooted; nearby blades same `windAt` | Per-blade phase via shade/bend offset into `windAt` |

**Unsolved**  
True height-texture sample in the blade vertex shader (perfect LOD morph match) — not done. Mid impostors still deferred. No global densify.

Files: `CoverGrass.tsx` (`buildChunk`), `core/shaders/grass.ts` (shared with Penglai — mild silhouette/colour improvement).

## 3. Same-camera / zoom

- Overview: shrub masses keep grey-green (+ sparse ochre/red patches); no full near mesh cost.  
- Near locate / Walk: branch + spray readable; mid↔near hysteresis reduces pop.  
- Continuous zoom: band hysteresis 8 m (same idea as pines). Eye-check recommended at woodland edge.

## 4. Environment view + performance defaults

- **Performance** (`stats`) default **off**.  
- **Nav diagnostics** remains Dev, default off.  
- Zones + Cover suitability → exclusive **Environment view**: Normal / Habitat zones / Grass density.  
- Heatmap confirmed = `softCoverDensityBytes` (**density**), renamed in legend/i18n.  
- Normal: no debug legend.  
- Leva has **no persist** — clean entry; user can re-enable.  
- Generation rules unchanged.

## 5. Resource atlas

**Included (Wonderland cards)**  
Vegetation: shrub, grass, flower, pine. Creatures: dwelling creature (size only), person. Props: stele. Terrain: island, peak, pool.  
Penglai shrub/pine/grass listed in shared `SHARED_RESOURCES` for scale parity (no Wonderland preview).

**Sizes**  
- Config: registry / `SHRUB_HEIGHT` / `COVER_NEAR` / `SIZES` / `STELE` / `ISLAND`.  
- Sample: atlas preview seed.  
- Island: live counts + measured ranges from current generate (shrubs, trees, cover stats, corner, pools).

**Preview**  
2D thumbs per card. Detail = **standalone** `WebGLRenderer` (not nested R3F Canvas) + 1 m ruler + optional 1.7 m person. Close disposes renderer. Locate uses real instance or shows “no instances”. Does not reseed.

**Not supported this round**  
Full creature mesh preview; accurate pine L-system in atlas (cone proxy); Penglai live island stats in this overlay.

## 6. Performance (same camera, qualitative)

| | Notes |
|---|---|
| CPU | Shrub LOD rebucket ~0.2 s / 4 m move; grass chunk build unchanged |
| GPU | Near shrubs cost only in camera ring; nested-canvas context loss fixed by standalone preview |
| Draws | +LOD bands (near/mid/far × variants × leaves/stems) but mid/far count dominates afar |
| Island counts | Seed 684: ~1103 shrubs, ~390 pines (woods); grass blades only near focus |

Measured GPU ms not captured this pass (stats off by default). Toggle Performance to compare.

## Checks

```
npx tsc --noEmit -p .
npx tsx scripts/check-shrubs.ts 684,7,42   # all hold
npx tsx scripts/check-world.ts            # all rules hold
```

Penglai: shared `grass.ts` only; shrub path still Wonderland-local. Spot-check `/#/atlas/island-v1`.

## Files

`ShrubPatches.tsx`, `shrubs.ts`, `CoverGrass.tsx`, `core/shaders/grass.ts`, `palette.ts`, `Scene.tsx`, `strings.ts`, `cdlod.ts` (comment), `ScaleView.tsx`, `index.css`, `core/resources/*`, `resourceCatalog.ts`, `ResourceAtlas.tsx`, docs (plan + this + handoff / world-plan / presentation).
