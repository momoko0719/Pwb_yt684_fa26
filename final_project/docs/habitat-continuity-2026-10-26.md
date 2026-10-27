# Habitat continuity — results (2026-10-26)

Plan: `habitat-continuity-plan-2026-10-26.md`.  
Evidence: `scripts/out/cover-focus-684-continuity.json`.

## 1. Status before / after — load centre

| Mode | Before | After |
|---|---|---|
| Walk | `cam + 18 m·flat(look)` | **unchanged** (`coverFocus` walk) |
| Orbit high overview | Same formula → focus **outside** (−417,368), **0 blades** while looking at island | **Ray march** to height map → hit on island (−8.6,−10.5); `near=false` → **0 near blades**, far tint still island-wide |
| Orbit mid/near wet | lookAhead could land in **water** | Ray hits **wetShore**; near blades on when dist &lt; 55 m |
| Ray miss (sky) | N/A | **Hold** last focus; no jump |

Files: `coverFocus.ts`, `CoverGrass.tsx` (`walking` prop from `Scene`).

Constants: `walkLookAhead=18`, `refocus=16`, `nearView=55`, chunk ring unchanged.

## 2. Far / mid / near

| Band | Behaviour |
|---|---|
| Far | `softCoverDensityBytes` on terrain (unchanged pipeline); overview intentionally **no** near instances |
| Mid | Terrain shader: stronger soil/moss **carpet** from real density + mid-distance falloff (`cdlod.ts`) — Penglai-style meadow read, **not** island-wide blades |
| Near | Chunked blades/flowers only when `nearBlades` (Walk always; Orbit when close to ray hit) |

Did **not** raise global `amount` / `clumpsPerM2` this pass.

## 3. Wet shore

- Cover suit: slope / `toWater` / hollow proxies (gentle + concave → sheet; steep → skip). Explicitly **not** hydrology.
- Terrain: wet bare stone vs local soil variation (noise), plus cover carpet — avoid equal-width grey-cyan ribbon.
- Jade stays wear-driven, separate from moisture damp.

## 4. Zone hard cuts

- Near hard exclude still: outside / water / cliff / ridge only.
- Woodland edge suit uses soft grove band (not a knife cut into open).
- Did **not** widen `SURFACE_BLEND_M` (14 m).

## 5. Probe numbers (seed 684)

| Case | Legacy zone | New source | Near | Disc blades |
|---|---|---|---|---|
| overview_orbit | outside | ray (terrace) | false | **0** |
| mid_wet_orbit | wetShore | ray wetShore | true | ~25500 |
| near_wet_orbit | **water** (bad) | ray wetShore | true | ~25370 |
| walk_near_wet | rockSlope | walk | true | ~26641 |
| sky miss hold | — | hold (−111,−143) | false | — |

Rebuild cost when near: same chunk path as before (~tens of ms on full miss; cache on move). GPU frame **未测**.

## 6. Visual verification status

| Check | Status |
|---|---|
| Probe / code Orbit vs Walk focus | **Done** |
| Debug OFF mid carpet / wet structure on owner GPU | **未目视确认** (IDE browser canvas unreliable) |
| Free pan second wet shore | Steps below — owner |

### Repeatable steps

1. `npx vite --port 5180` → `#/atlas/wonderland-terrain`, seed 684.  
2. Zones / Cover suitability / Scale **OFF**.  
3. Island overview → confirm far patch tint; Cover stream should show `far` / near blades ~0.  
4. Orbit zoom toward a stream bank (wheel + drag, **not** required Look-at) until ~eye-level → blades appear on the **looked-at** shore.  
5. Pan along the shore to another bend → focus follows ray; stream line shows `ray`.  
6. Optional: Cover → Look at wet shore as a known frame, then leave it and free-browse.

## 7. Remaining

- Owner GPU beauty pass (mid carpet thickness, wet stone vs soil, no circular load pop).  
- If mid still too flat, next option: cheap mid impostor clumps (not done this pass).  
- Multi-creature deferred.
