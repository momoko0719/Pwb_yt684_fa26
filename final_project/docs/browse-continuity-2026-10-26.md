# Browse continuity — report (2026-10-26)

Plan: `browse-continuity-plan-2026-10-26.md`. Seed **684**. No grass-amount / blank-stone excuses; LOD distances not “solved” by only pushing them out.

## 1. Root causes (confirmed) vs still open

| Issue | Confirmed cause | Files | Still open |
|---|---|---|---|
| Grass pop | Hard `near = dist < 55`; flip → `clearNear` / full assemble; focus-baked disc edge in chunk cache; **no** camera–blade fade | `coverFocus.ts`, `CoverGrass.tsx`, `grass.ts` | Owner GPU beauty: dither quality mid→near |
| Far/mid/near colour | Mid “carpet” = **albedo-only** soil/tint mix; stacked with near blades (root ×0.65) → sudden dark green | `cdlod.ts`, `grass.ts` | No real mid **volume** (impostors deferred) |
| Pine LOD jump | Hard 90/260 switch; pale flat pads vs dark grown needles | `pine.ts` `forestPineModel`, `Vegetation.tsx` | Corner `THREE.LOD` still hard (few trees) |
| Wheel region fight | `zoomToCursor` + fixed 2 m floor clamp every frame; veg/grass in raycast; focus anim not interruptible | `Scene.tsx`, `OrbitFocus.tsx`, Vegetation/CoverGrass | Water sheets still raycast (shore may anchor on water) |
| Shore facets | **Hypothesis:** CDLOD coarse patch + morph near steep banks / height texel — not cover | `cdlod.ts`, height grid | Needs GPU wireframe check; no large terrain rewrite this pass |

### Mid carpet (exact, for the record)

Implements **only** terrain fragment colour mixes (`uCoverSoil`, `uCoverTint`) weighted by cover density and camera `dist`. Does **not** add vegetation volume, blade instances, cover-specific normals, or roughness/spec changes.

## 2. LOD / load / fade (before → after)

### Grass / cover stream

| | Before | After |
|---|---|---|
| Load gate | hard `nearView` 55 m | **loadOn 64** / **loadOff 82** hysteresis |
| Display | on/off with load | **fadeOn 40 → fadeOff 74** (camera–hit) + smooth chase; clear only when visibility &lt; ~0.04 |
| Blade fade | none (opaque) | dither discard by **camera–blade** `fadeNear 34` / `fadeFar 54` + `uVisibility` |
| Chunks | focus edge baked into cache (circular + stale) | world-deterministic chunks; assemble disc cull for capacity; soft rim = shader |
| Capacity | ~disc | assemble hard radius 48 m; probe near-wet ~28k blades (not island-wide) |

### Terrain cover colour

| | Before | After |
|---|---|---|
| Mid strength | soil 0.52 + carpet mid 0.38 | soil 0.38; carpet lower; bias to `uCoverTint` |
| Near handoff | carpet full under blades | carpet ×(1−0.78×bladeHandoff) for dist ≲50 m |

### Pine

| | Before | After |
|---|---|---|
| Distances | 90 / 260 | **unchanged** (not pushed out) |
| Hysteresis | none | ±**12 m** per tree in `Vegetation` |
| Stand-in | pale tops, mid-only thin trunk | darker pad tops/underside, rim thickness, trunk on mid **and** far |

## 3. Wheel zoom — triggers and fixes

**Observed code triggers (pre-fix):**

1. Per-frame `floor(camera, CLEARANCE=2)` + `floor(target, 0.35)` fighting `zoomToCursor` near slopes/shores.
2. Grass/pine instances winning raycast → zoom anchor jumps.
3. Double-click focus RAF continuing through wheel/drag.

**Fixes:**

- Clearance scales with cam↔target distance (min ~0.55 m near ground; full 2 m overview); target only lifted if clearly underground.
- Cover + forest pines: `raycast` no-op + `orbitIgnore`.
- OrbitFocus cancelled on wheel / pointerdown.
- **Debug → Nav diagnostics** (default off): cam, target, dist, hit name/point/dist, wheel Δ, cam Δ, minDistance, floor flags, focusAnim, cover rebuild ms.

**Expected after:** open flat / shore / slope / terrace respond more predictably; true block = minDistance or floor clamp (diag shows which). Not verified on owner GPU this session.

## 4. Continuous browse (code-level)

- Wet shore far→near→far: load hysteresis + fade; no instant empty disc at 55 m.
- Chunk pan: cache stable; no focus-baked circular rebuild.
- Pine: same thresholds + hysteresis + darker stand-ins.
- Walk: still always-load; blade distance fade applies.

**Not claimed:** zero remaining dither noise; mid volume equal to near; headless GPU ms.

## 5. CPU / performance

- Probe assemble (near wet, seed 684): ~28k blades in streamed disc (see `scripts/out/cover-focus-684-browse.json`).
- Cover rebuild ms exposed in nav diag when chunks miss cache.
- **No live GPU frame times** measured this pass (state explicitly).

## 6. Shore facets

Likely CDLOD patch size / morph vs bank slope (and possibly water sheet vs height). **No local mesh fix** this pass without widening terrain LOD scope. Reproduce: Debug → Show the patches near a crease; facets that track patch boundaries = CDLOD; facets that stay when finest LOD = height/normal bake.

## 7. Unverified + shortest repro

1. Orbit: overview → zoom one wet shore → pan second shore (Zones/Cover debug **OFF**). Watch for pop / colour jump.
2. Debug → Nav diagnostics ON; same wheel ticks on open stone, stream bank, steep rock, terrace rim — compare hit name + floor flags.
3. Dolly past one grove pine through ~90 m — silhouette/colour family.
4. Walk across a cover chunk boundary.

```
cd final_project
npx vite --port 5180 --strictPort
npx tsx scripts/probe-cover-focus.ts   # → scripts/out/cover-focus-684-browse.json
npx tsc --noEmit
```

## Next agent

1. Owner GPU beauty pass (items in §7).
2. If water-hit zoom still odd: consider `orbitIgnore` on runoff sheets (trade: shore may miss water surface).
3. Optional mid impostors if albedo handoff still feels flat.
4. Shore facet: wireframe confirmation → then targeted CDLOD/height fix only.
