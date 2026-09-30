# Handover: island-v1, next round (underside, peaks, peak spread)

You are continuing work on "Guixu 归墟", a procedural floating-island world (Cornell Tech
DESIGN 6197). The site and the island already work. This round fixes three things only.
**Do not redesign anything else.** The previous hand-off failed because the agent rewrote
large parts of the project; the owner rejected it. Small, targeted diffs only.

## 0. Rules (non-negotiable)

- Work only inside `final_project/`. Do not touch `class_02`–`class_05`, the repo-root
  `docs/`, or create a new repo. `final_project/docs/` may be edited.
- Code, comments, names, docs, commit messages: English. Chat replies to the owner: Chinese.
- **Before writing code, send the owner a short plan in Chinese** (what changes, what does
  not, which constants/params) and wait for confirmation.
- Everything is procedural and generated in code. No hard-coded shapes, meshes, images,
  models or external assets. No new dependencies.
- All randomness through `createRng` in `src/core/rng.ts`; never `Math.random()`.
- `src/core/generators/*` stay pure: no React, no leva, no globals, no three.js imports
  other than what `island.ts` already uses.
- Colors only from `src/core/palette.ts`; do not change `palette.ui`.
- All visible text from `src/i18n/strings.ts` (EN + ZH). Every parameter has a bilingual
  hint saying what it controls and which class technique it uses (or "outside the course").
- Leva folder names stay English: Shape, Surface, Atmosphere, Camera, Export.
- Out of scope: vegetation, creatures, water (next round), post-processing, shadows, new
  render systems, directory restructuring, palette/UI/theme/time/fog changes, the leva
  plugins in `src/leva/` (except removing one usage, see task 1).
- Do not commit; the owner commits.
- Keep the top surface (plateau, rim outline, meadow/rock shading) as it is. The owner likes
  the current realistic look of the top.

## 1. Read first (in this order)

1. `final_project/README.md` — layout and rules.
2. `final_project/docs/world-concept.md` and `final_project/docs/islands/penglai.md` — what
   the island should feel like (Penglai, Huangshan-like stone peaks, hanging island).
3. `final_project/src/experiments/island-v1/notes.md` — history of every change, especially
   the last section ("Underside as one mass...").
4. `final_project/src/core/generators/island.ts` — the generator (read all of it).
5. `final_project/src/core/params/island.ts`, `src/core/presets/penglai.json`,
   `src/experiments/island-v1/controls.ts`, `src/experiments/island-v1/meta.json`.
6. `final_project/src/core/generators/islandStages.ts` — 2D maps for the techniques panel;
   it calls the same field functions, so it follows generator changes automatically.
7. Read-only, for technique attribution: `class_03` (noise, fbm, heightmaps, shaping),
   `class_04/tutorials/Voxel Density CSG and Meshing.md` (CSG union / smooth union),
   `class_05/tutorials/Shader Lab.md` (slope, distance, Fresnel, position gradient).

## 2. How the generator works now (so you change only what is needed)

- Two polar grids: top `(angle, t) -> rim(angle) * t` with height `heightAt`; underside
  `bottom(angle, t)` from rim (t = 0) to tip (t = 1). They share the rim ring, so the
  seam is closed: **top at t = 1 must equal bottom at t = 0**. Keep that.
- `createIslandField(p)` returns `{ noise, peaks, rim, plateau, lift, heightAt, top, rimY }`.
  `lift(x, z)` is the peak contribution (max-union of per-peak `peakLift`).
- Peaks: `placePeaks(p)` places one main peak + `peakCount` spires by seeded rejection
  sampling; `peakLift` makes flat-topped columns from a distance mask with an angular noise
  outline (`PEAK_WOBBLE`), slight wall lean (`PEAK_TAPER`), and a sine ripple.
- Params (Shape): seed, radius, taper, smoothness, peakHeight, peakCount, peakSpread,
  frequency, ridgeSharpness, undersideDepth, resolution. Surface: meadowLine (height-based
  grass line; thresholds in `SURFACE_RULES` in `params/island.ts`, used by
  `shaders/terrain.ts` and `islandStages.ts`).

## 3. Tasks

### Task 1 — Underside: one long, irregular inverted stone peak ("umbrella handle")

Owner's complaint: the current underside looks carved, like knife cuts gouged inward; worse
than the first version. Wanted: below the cliff, the mass hangs down as **one long,
irregular stem, like an inverted mountain / stone peak**, tapering to a tip. Whole and
continuous, no slots, no flat bottom, no separate sticks.

Root cause of the "knife cuts": in `bottom()`, `reach = ROOT_REACH_MIN + ... * columnAt()`
makes some directions collapse to radius 0 at 40% depth while neighbours continue, which
cuts deep radial slots. Also `ROOT_STRATA` adds horizontal notches.

Direction (keep it procedural, adjust constants by testing):
- Remove the per-direction `reach` mask (`columnAt`, `ROOT_LOBES`, `ROOT_REACH_MIN`) and
  `ROOT_STRATA`. Every direction follows the same depth profile, so the silhouette is one
  body.
- New radial profile `profile(t)`, a single smooth curve in code (no lookup tables):
  a short near-vertical cliff band under the rim (about the first 10–15% of depth), a
  concave "shoulder" that narrows fast to a stem radius (about 0.2–0.35 of the rim radius)
  by roughly 35–45% depth, then a long stem that slowly tapers to a point at t = 1. Make
  the transitions C1-smooth (e.g. blend with smoothstep or a sum of power terms), no
  creases.
- Irregular stem: (a) bend the stem axis with smooth 1D noise of t (offset grows with t,
  a fraction of the radius), so it curves like a hanging stone peak rather than a straight
  cone; (b) irregular cross-section with low-frequency angular fbm sampled on a circle
  (`cos(angle), sin(angle)`), a few lobes, amplitude proportional to the local radius;
  (c) vertical ridges/gullies like a mountain seen upside down: ridged angular noise that
  stays roughly constant along depth (slowly varying with t), small amplitude. Keep noise
  isotropic — do not sample along a diagonal sweep of t (that produced the old "pineapple").
- Params: keep `undersideDepth` (the stem length; raise the Penglai default so the stem
  reads as long, e.g. 1.2–1.6 × radius — test). Redefine `taper` as stem thickness /
  how fast the shoulder narrows (0..1) and keep it as a plain slider. `smoothness` keeps
  lowering fbm gain for the underside too.
- **Remove the curve preview for taper**: in `controls.ts` replace
  `curve({... shape: rootSilhouette ...})` with a normal number field; delete
  `rootSilhouette` from `island.ts` if nothing else uses it. Keep the `curve` plugin
  itself (ridgeSharpness still uses it).
- Mesh: check the underside has enough rings along depth for a long stem (it uses the same
  ring count as the top); increase only the underside's depth subdivisions if needed.
- Update `hint.taper`, `hint.undersideDepth`, `tech.heightfield.how` (EN + ZH).
  Technique attribution: power/smoothstep shaping (Class 03), fbm / ridged fbm (Class 03).

### Task 2 — Peaks: real mountains, not five wooden stakes

Owner: the peaks look like 5 wooden posts. Make them normal, natural mountain peaks,
slimmer and more peak-like; keep a little of the current character (irregular outline,
steep upper flanks, varied heights).

Direction:
- Keep `placePeaks` structure (main peak + spires, stratified heights, seeded). Replace the
  flat-topped column profile in `peakLift` with a peak profile: height falls from a narrow
  rounded summit to a wide base, e.g. `h * pow(1 - d / baseRadius, k)` shaped so flanks are
  steep near the top and spread into the plateau at the foot (base radius clearly larger
  than the current column radius; summit is a point, not a plateau).
- Keep the irregular outline (angular noise on distance, `PEAK_WOBBLE`) and add ridges
  radiating from the summit (ridged fbm or angular ridged noise, Class 03) so flanks have
  arêtes and gullies. Drop or greatly soften the sine ripple bands.
- Merge neighbouring peaks with a smooth union (smooth max) instead of hard max so they
  share saddles (cite Class 04 CSG union / smooth union if the tutorial covers it,
  otherwise "outside the course").
- The top grid must resolve slimmer peaks; check `resolution` 128 still looks fine.
- Grass: meadow is height + slope based and should keep working; check spire flanks do not
  turn green.
- Update `tech.columns.*` and `hint.peakHeight` / `hint.peakCount` text if they describe
  columns.

### Task 3 — Peak spread must actually spread

Owner: `peakSpread = 1` looks the same as the default; at 1 peaks should spread out toward
the island edge.

Root cause: `PEAK_LIMIT = 0.55` (every peak must satisfy `dist + radius*(1+WOBBLE) <=
0.55R`) and `CLUSTER_RADIUS` max 0.55R. The default spread 0.4 already fills almost that
disc, so 1 changes nothing.

Direction:
- Make the limit depend on spread: roughly 0.4R at spread 0 up to about 0.8–0.85R at
  spread 1, measured against the actual rim at that angle (`rim(atan2(z, x))`, which
  varies with the bays), leaving a margin inside the shoulder (`PLATEAU_EDGE = 0.78` of
  the rim). This needs `rim` passed into `placePeaks`.
- Cluster radius and gap scale with spread up to that limit; at 1 sample the whole allowed
  disc (uniform area sampling via `sqrt(rng())`), so peaks sit near the edge too.
- Verify numerically: farthest peak distance / R for spread 0, 0.5, 1 over several seeds
  must clearly increase (e.g. ~0.35 → ~0.55 → ~0.8).

## 4. Verification (do all before reporting)

- `npm run build` in `final_project/` (runs `tsc --noEmit && vite build`).
- Node checks via vite SSR (PowerShell here-string, `node --input-type=module -e $js`):
  `createServer({ server: { middlewareMode: true }, appType: 'custom' })`, then
  `ssrLoadModule('/src/core/generators/island.ts')`. Check: determinism (same params →
  identical positions), no NaN, seam closed, mean underside radius per depth decreases
  monotonically and smoothly, farthest peak per spread, meadow share, generation time
  (~100 ms now).
- GLSL: if you touch shaders, avoid reserved words (`flat`, `smooth`, `sample`, `input`,
  `output`, `filter`, `active`, ...). A shader compile error hides the whole island.
- leva custom inputs: never give the input object a `value` key (leva drops the other
  settings); existing plugins use `current` / `hour` / `selected`.
- Append a short section to `src/experiments/island-v1/notes.md`: what changed, algorithm
  vs default changes, measured numbers.
- Report to the owner in Chinese: files changed, params/constants changed, what to look at
  in the browser. Then stop and wait.
