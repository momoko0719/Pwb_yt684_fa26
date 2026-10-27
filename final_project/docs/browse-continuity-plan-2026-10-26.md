# Browse continuity — plan (2026-10-26)

**Goal:** Fix continuous Orbit/Walk browsing — grass pop-in, far/mid/near colour mismatch, pine LOD silhouette jump, unpredictable wheel zoom. **Do not** raise grass amount, widen blank-stone “留白” excuses, or only push LOD distances out. No new vegetation features this pass.

## Must-read (verify before edit)

| File | Why |
|---|---|
| `coverFocus.ts` | Orbit ray + **hard** `nearView: 55` boolean |
| `CoverGrass.tsx` | Chunk cache; `clearNear` / `assemble` on `near` flip; focus-baked disc edge |
| `core/shaders/grass.ts` | No camera-distance fade (opaque blades) |
| `core/terrain/cdlod.ts` | Mid “carpet” = **albedo mix only** (soil/tint), ~12–120 m `dist` |
| `woods.ts` / `Vegetation.tsx` / `pine.ts` `forestPineModel` | Hard 90 / 260 m; flat pads vs L-system |
| `Scene.tsx` Ground `useFrame` | Per-frame floor clamp + `OrbitControls` `zoomToCursor` |
| `OrbitFocus.tsx` | Dblclick focus anim — no user-interrupt |
| `scripts/probe-cover-focus.ts` | Focus evidence |

## Confirmed root causes (from code, pre-fix)

1. **Grass hard switch**
   - `near = dist < 55` with **no hysteresis**; flip → `clearNear` empties all blades or `assemble` fills them in one frame.
   - Fade is **not** camera-to-blade: only a **focus-centred** soft disc baked into `buildChunk` (`edge` vs `fx,fz`) → circular boundary; cached chunks wrongly keep old focus edge.
   - Miss / `near` false → immediate delete of instances (no fade-out).

2. **Mid carpet (exact)**
   - Shader-only: mixes `uCoverSoil` / `uCoverTint` into terrain **colour**. Does **not** change vegetation volume, blade instances, or cover-specific normals. Roughness/specular unchanged for cover.
   - Mid strength peaks ~18–70 m; far quieter. When near blades appear, carpet still full → double green/dark weight + blade root darkening (`×0.65`).

3. **Pine LOD**
   - Instant band switch at `WOODS_LOD = [90, 260]`; mid/far = flat irregular pads (+ thin mid trunk). Same material colours, but silhouette/density read as another tree. Fix model + hysteresis, not only larger near range.

4. **Wheel (diagnose first)**
   - `zoomToCursor` + every-frame `floor(camera, CLEARANCE)` / `floor(target, 0.35)` can fight dolly near slopes/water.
   - OrbitFocus RAF not cancelled by wheel/drag.
   - Unknown until nav diag: which mesh wins raycast (terrain vs water vs vegetation).

5. **Shore facets (hypothesis)**
   - Likely CDLOD coarse patch + morph / height texel near steep banks — not cover. Confirm; local fix only if cheap; else record root cause.

## Implementation order

### A. Load vs display (grass)

- Prefetch/assemble when camera–hit within **load enter**; clear only after **load exit** (hysteresis) and fade ≈ 0.
- Chunks **world-deterministic** (no focus-baked edge); stream by chunk ring only.
- Shader: soft **camera→blade** distance fade (dither discard); optional global visibility from load fade.
- Keep `cacheMax`, seed determinism; no island-wide fine grass.

### B. Far / mid / near colour

- Reduce terrain carpet as camera approaches blade band (handoff, not stack).
- Align mid tint weight with `PORCELAIN.cover`; lighten blade root slightly so blades don’t suddenly darken the patch.
- Prefer dither/fade over heavy transparency.

### C. Pine LOD

- Retune `forestPineModel` proportions (trunk, pad radii, shade) toward grown crown read.
- Per-tree hysteresis on band edges in `Vegetation` (and corner LOD distances if needed). **Do not** only raise 90 m.

### D. Nav diagnostics + zoom

- Debug toggle **off by default**: camera, target, distance, cursor hit object/point/dist, wheel Δ vs camera Δ, minDistance / floor clamp / focus-anim flags, cover `buildMs`.
- Interrupt OrbitFocus on pointer/wheel; soften clamp fight without lowering safety into the ground.

### E. Shore facets

- Probe: same viewpoint with wireframe / LOD range; note if facets track patch size. Fix only if local; else doc.

## Verification

| Test | Pass |
|---|---|
| Wet shore far → near → far | No full-disc pop; colour continuous |
| Pan across chunk boundary | No whole-chunk pop / circular rim |
| One pine across 90 m | Same species read; less colour flip |
| Wheel: open / shore / slope / terrace | Predictable; stop when blocked; diag explains fights |
| Walk across load edge | Soft fade, no flash |

Probes: `npx tsx scripts/probe-cover-focus.ts` (+ new nav/continuity notes in report). GPU frame times: state if unavailable.

## Docs after

Update `wonderland-handoff.md`, `wonderland-world-plan.md`, `presentation-notes.md`; write `browse-continuity-2026-10-26.md` report.
