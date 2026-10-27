# Navigation speed · feel · stability — 2026-10-26

Evidence: `scripts/out/walk-speed-684.json`, `scripts/out/cover-build-684.json`, live stats on `:5180`, code in `wonderlandWalk.ts` / `Walk.tsx` / `OrbitFocus.tsx` / `CoverGrass.tsx` / `Scene.tsx`.

## A. Move root cause (before → after)

| Item | Before | After |
|---|---|---|
| Panel default | `SIZES.person.walk` **1.3 m/s** | `WONDER_BROWSE.browse` **3.0 m/s** (`Walk.tsx` / leva `walkSpeed`) |
| Units | m/s into `stepWonderWalker(..., speed, dt)` | unchanged; **1 unit = 1 m** |
| Shift | `WALK.runFactor` 2.5 → ~3.25 m/s | absolute **`WONDER_BROWSE.run = 5`** |
| Accel / stop | shared `WALK.accel = 8` both ways → long slide | accel **14** / stop **22**; snap `|v|<0.05` |
| Delta | `Math.min(delta, 0.05)` seconds | same; **not** dwelling ×30 |
| Heading | `atan2(look.z, look.x)` horizontal | same — pitch does not cut ground speed |
| Slope / water | `canStep` + zone forbid + waterDepth | same; axis slide then hard stop |
| Dwelling link | none on speed | none; Walk gates sim with `run && !walk` |

**Feel root cause was not “real scale wrong”:** base 1.3 m/s + slow shared ease made Walk feel like a continuous slide. Terrain was not rescaled.

## B. Measured speeds (seed 684, flat dry spawn)

Probe: `npx tsx scripts/probe-walk-speed.ts` → `scripts/out/walk-speed-684.json`.

Spawn ≈ (−29.3, 114.5), feet Y ≈ 1.50. Steady window after **0.5 s** accel; stop = release → `|v|<0.05`.

| Mode | Set m/s | Steady m/s | Dist / 2 s | Stop s | Diag |v| | FPS |
|---|---|---|---|---|---|---|
| browse (default) | 3.0 | **3.025** | 6.05 m | 0.20 | 3.0 | 60 |
| walk | 1.4 | **1.412** | 2.82 m | 0.17 | 1.4 | 60 |
| run (Shift) | 5.0 | **5.042** | 10.08 m | 0.22 | 5.0 | 60 |
| browse @ dt=0.05 | 3.0 | **3.0** | — | — | — | ~20 cap |

Diagonal input is normalised — `|v|` matches axis target (no √2 boost).

## C. Hitch / cover

| Trigger | Before | After (measured) |
|---|---|---|
| Enter Walk / refocus | full disc `buildSites` + BufferGeometry | **chunk cache** 24 m × 5×5; only misses built |
| Wear / trample | `mapVersion` rebuilt grass | **shader `uWear`** upload only (`grass.ts`) |
| Full disc CPU (probe) | — | **0.7–2.7 ms** wall (`cover-build-684.json`) |
| Live first disc | — | `chunks 25 · built 25 · ~3.0 ms` (browser stats) |
| Live Walk enter (cache warm) | — | `built 17 · 0.7 ms` |
| Frame-time spike on GPU | **未测** (headless FPS ignored) | **未测** owner GPU |
| rAF one-frame defer | not used as “fix” | not relied on |

Assemble still concatenates cached chunks and recreates geometry when focus moves >16 m — cheap vs full rebuild; further batching only if owner GPU still spikes.

**Dwelling pause while Walk:** still useful (creature + contact map CPU), not because grass rebuilds. Not made permanent — panel `Run` is untouched; gate is `dwell.run && !view.walk`. Stats now show “Dwelling temporarily paused” when Walk is on and Run was true.

## D. Navigation ops

| Action | Behaviour |
|---|---|
| LMB drag | Orbit rotate around **current** target (no pivot snap on press) |
| RMB / middle | screen-space pan (`screenSpacePanning`) |
| Wheel | drei/three **`zoomToCursor`**: ray through cursor onto scene meshes; sky/cloud use `noRaycast` so terrain wins. Project does **not** replace with SDF pick |
| Double-click | `OrbitFocus.tsx`: raycast → soft lerp target + camera (~420 ms); sky/miss = no-op; clearance via `above` |
| Walk on | unmount Orbit; PointerLock; spawn on walkable; eye ~1.6 m |
| Esc | **unlock pointer only** — stays in Walk |
| Walk off | restore orbit camera + target (`OrbitRestoreCapture`); resume dwelling if panel Run still on |
| Leva / UI | outside canvas — does not drag scene |

`maxPolarAngle = 0.6π`; ground clamp skipped while Walk; orbit clearance modest so it does not fight zoom.

## E. Surfaces & cover

- Normal view: Zones / Cover suitability / Scale **OFF**. Soft weights `SURFACE_BLEND_M = 14` + warp ±~8 m (`surfaceBlend.ts`).
- Relative size: creek width ≈ `2.4√flowShare` (~4–6 m typical); wet/habitat bands tens of metres. **14 m edge is wide vs creek — do not increase further** without new evidence; optional future tighten.
- Far wet/wood: camera + look-ahead stream; browser near-ground: grass **1031–2133** blades, flowers present, stream `built` drops after cache.
- Trample: wear texture updates with `map.version`; blades discard via `uWear` — no geometry rebuild.

## F. Done / remaining

**Done:** speed tiers + stop, OrbitFocus, chunk+wear, dwell gate + hint + stats, probes, strings (m/s units).

**Remaining / 未测:**
- Owner GPU frame spikes while continuous Walk.
- Full interactive chain (dblclick → wheel → pan → pointer-lock WASD → exit restore) in IDE browser: Walk UI + hint verified; pointer-lock / dblclick coords **blocked** (narrow pane / no lock). Playwright QA needs `npx playwright install`.
- Soft-edge width tighten (optional).
- Multi-creature deferred.

### Short reproduce

1. `npx vite --port 5180` → `/#/atlas/wonderland-terrain`, seed 684.  
2. Zones / Cover suitability / Scale OFF.  
3. Overview → double-click ground → wheel/pan.  
4. View → Walk (default 3 m/s) → click canvas → WASD / Shift → Esc unlock → toggle Walk off.  
5. Watch Cover stream `built` / `ms`; confirm dwell hint when Run was on.
