# Surface edges · navigation · Walk · cover stream — 2026-10-26

Normal browse (Zones / Cover / Scale **off**). No new creatures or buildings.

## Diagnosis (before)

| Issue | Root cause |
|---|---|
| Blocky wet/litter | Zone texture **Nearest** + hard `if (zk==…)` material; cover tint on **2 m** density cells |
| Orbit stuck | No `zoomToCursor`; sky/cloud could steal raycasts |
| “Tour” | Penglai has **Walk** (free WASD), not auto tour; Wonderland had none |
| Grass near creature only | `CoverGrass` focused on **OrbitControls.target** |

## Fixes (this pass)

### A. Surfaces
- Labels stay discrete (`uZones` Nearest) for rules / debug.
- Soft RGBA weights (`surfaceBlend.ts`, **~14 m** soft edge + **±8 m** low-freq warp) → `uSurface` LinearFilter.
- Shader also mixes continuous **moisture** / **grove** (Linear) so edges follow world fields, not stair-shaped zone blobs.
- Far cover tint uses `softCoverDensityBytes` (~16 m) — blade rules stay sharp + zone hard exclude.
- Files: `surfaceBlend.ts`, `cdlod.ts`, `Scene.tsx`, `cover.ts`.

### B. Orbit
- `zoomToCursor`, damping, minDistance 2.5, maxPolarAngle, RMB pan (three.js default).
- Sky / cloud `raycast` no-op so zoom hits terrain.
- Files: `Scene.tsx`, `world.tsx`.

### C. Walk (= Penglai 漫游, not auto Tour)
- Eye **1.6 m**; speeds in `WONDER_BROWSE` (browse **3** / walk **1.4** / Shift **5** m/s) — evidence `nav-speed-stability-2026-10-26.md`.
- Wonderland feet: `wonderlandWalk.ts` + `Walk.tsx` (PointerLock, WASD). Esc unlocks only; toggle Walk off restores orbit.
- Dwelling gated `run && !walk` (hint + stats); Walk speed independent of ×30.
- No water/terrace/cliff spawn or step.

### D. Cover stream
- Focus = **camera XZ + look-ahead** (not Orbit target / creature).
- World **24 m** chunks + **cache**; wear via grass `uWear` (no rebuild on trample).
- Probe: `npx tsx scripts/probe-cover-stream.ts` / `probe-cover-build.ts` — remote wet loads; disc build ~1–3 ms.

## Commands

```
npx tsc --noEmit -p .
npx tsx scripts/probe-cover-stream.ts 684
npx tsx scripts/probe-cover-habitats.ts
node scripts/qa-screenshots.mjs   # vite :5180
```

## Limits
- Pointer-lock WASD / dblclick feel: Walk UI verified live; full lock interaction **未完整** in IDE browser pane.
- Owner GPU frame spikes **未测**. Soft blend 14 m wide vs creek — do not widen further.
