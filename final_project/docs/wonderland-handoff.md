# Wonderland — hand-off

For a new session continuing the Wonderland work. Keep this file true: update it after each step
and before stopping. The plan it serves: `wonderland-world-plan.md`.

## 1. Rules of work

- Chat with the owner in Chinese; code, comments, docs in English. The owner commits.
- New features: a short plan in Chinese first; lo-fi options before any new landform
  (the owner's standing preference). For the current round the owner said go ahead step by step.
- Real scale, 1 unit = 1 m. Colours only from `src/core/palette.ts`; randomness only through
  `src/core/rng.ts`; visible text only from `src/i18n/strings.ts` (en + zh).
- No hand coordinates: everything placed by rule from the seed and design parameters.

## 2. Read in this order

1. `docs/wonderland-world-plan.md`: goal, decisions, round 1 steps and acceptance.
2. `docs/wonderland.md`: design and art direction (theme, look, systems).
3. `docs/course.md`, `docs/scale.md`: course dates and rubric; sizes.
4. `src/experiments/wonderland-terrain/notes.md`: history of every round, with measurements.
5. The code, `src/experiments/wonderland-terrain/`:
   - `Scene.tsx`: the page. Panel (leva), the worker, the dwelling and corner, the ground
     component (terrain, pools, falls, streams, underside), camera presets.
   - `terrain.worker.ts`: builds ground, terrace, water, underside off the main thread; bakes light.
   - `layout.ts`: fixed design numbers only (seed, island axes, terrace levels).
   - `frame.ts`: how the parts lie, from the seed and design relations (back direction, basin,
     plates, range centre, keel).
   - `ground.ts`: the ground's rules (outline, meadow and its swells, plates and their outlets,
     range on top) and the height-grid bake.
   - `zones.ts`: the island's zones from the ground as built; dry-land regions.
   - `woods.ts`: groves and lone pines from the zones; keep-outs for the creature's sites.
   - `range.ts`: the ring of peaks (rows, spurs, gullies).
   - `terrace.ts`: the plates as pools: rims, outlets, falls between them.
   - `water.ts`: below the terrace: plunge pool, channel, fan of streams, water field, falls.
   - `dwelling.ts`: the creature (sites, state machine, A*, gait, contact map). Plain TypeScript.
   - `creature.tsx`: draws it, uploads the contact map to the ground shader.
   - `corner.tsx`: by rule around its home: two pines, a watching stone, the camera views.
   - `world.tsx`: sky, sun, frame timing, the `guixuProbe` dev hook.
   - `particles.tsx`: water debug particles.
6. Shared: `src/core/terrain/cdlod.ts` (ground shader: porcelain, jade from contact),
   `src/core/shaders/porcelain.ts`, `src/core/terrain/*` (height grid, potential flow, meshes),
   `src/core/generators/pine.ts` (L-system pine), `src/experiments/island-v1/Vegetation.tsx`
   (Penglai's instanced pine LOD), `src/core/scale.ts`.

## 3. Run

```
cd final_project
npx vite --port 5180 --strictPort
```

Page: `http://localhost:5180/#/atlas/wonderland-terrain`. Demo seed 684 (panel: Island → seed).
Dwelling panel: run, speed (30×), home A/B/C, show (debug marks); buttons reset, look at it, its
home, close to the ground. Dev hooks in the browser console: `guixuProbe` (gl, scene, camera,
controls), `guixuDwelling` (the sim: `reset()`, `step(dt)`, `cycles`, `pose`, `map`).

Browser pane notes: a hidden pane stops drawing (no frames). Open a new tab instead of reloading;
to grab frames without the pane in front, import `@react-three/fiber` in the page and call
`advance(t)` before `canvas.toDataURL()`.

## 4. State

Branch `main`, last commit `ce3b534` (Penglai at real scale; Wonderland design). Everything
Wonderland since is uncommitted (the owner commits):

- Modified (tracked): `docs/wonderland.md`, `src/core/generators/{cover,island,pools}.ts`,
  `src/core/palette.ts` (PORCELAIN, WEAR_DEBUG, ZONE_DEBUG), `src/core/params/island.ts`,
  `src/core/shaders/pool.ts`, `src/experiments/island-v1/{controls.ts,notes.md,Vegetation.tsx}`
  (Vegetation: optional `lod` prop), `src/i18n/strings.ts`, `src/index.css`.
- New (untracked): `src/core/sdf/`, `src/core/terrain/` (incl. `cdlod.ts`: jade, zone overlay),
  `src/core/shaders/porcelain.ts`, `src/experiments/wonderland-terrain/` (incl. `frame.ts`,
  `zones.ts`, `woods.ts`, this round), `docs/wonderland-world-plan.md`, this file,
  `scripts/check-world.ts`, `scripts/check-water.ts`, `scripts/check-dwelling.ts`.
- Removed this round: `wonderland-terrain/blocks.tsx`, the blockout strings, `scripts/place-check.ts`,
  `scripts/zone-probe.ts`.
- Repo root (not the project): `.pnpm-store/`, `class_06/`, `class_07/` PDFs, untracked.

## 5. Done, and next

Done before the plan: terrain (CDLOD), terrace pools and falls, water system, underside, the
creature with real contact and jade, the corner, the rest-area material round.

Round 1 (2026-10-25), all done; details and acceptance in the plan, section 7:

- [x] R1.1 layout rules (`frame.ts`; swells by rule in `ground.ts`; pass on the open axis)
- [x] R1.2 placeholders (removed; hall dropped; person on the watching stone)
- [x] R1.3 zone field (`zones.ts`, worker, View → Zones)
- [x] R1.4 woodland (`woods.ts`, Vegetation with `WOODS_LOD`)
- [x] R1.5 checks and views (`check-world.ts`; shots `round1-*.png`)

Next, directly actionable:

1. Owner review of round 1 (shots `src/experiments/wonderland-terrain/shots/round1-*.png`).
2. Presentation views: overview → area → close → back as camera presets chosen by rule (area:
   the plunge pool, a grove, a peak; close: the creature's home), panel buttons, eased moves.
3. Round 2 (plan section 9): homes and drinking places per dry-land region (`zones.regions`),
   individuals with preferences, the contact scheme decision (plan section 8).

## 6. Checks

All from `final_project/`, Node with `npx tsx`:

| Command | What | Result (2026-10-25, after round 1) |
|---|---|---|
| `npx tsc --noEmit -p .` | types | clean |
| `npx tsx scripts/check-world.ts [seeds] [maps dir]` | layout constraints, zones, groves, regions, woods, creature sites and a 10-cycle run with trees as obstacles, reproducibility | 8 seeds (684, 7, 42, 1234, 2026, 9001, 5, 333): all rules hold; same seed → same hash |
| `npx tsx scripts/check-water.ts` | water continuity, 4 seeds × 3 flows (`VARIATION=0` for the agreed layout) | 8 flags (5 before the layout change; 9 with variation 0). At the default flow 15: seed 684 pool 0, 3 particle steps off the water; seed 7, one particle of 12 from the spring circling an eddy in the top pool without reaching a lip; seed 1234, 21 of 24 plunge→rim particles. The rest at flows 0.3 and 3. Same kinds as the known flags; none seen in the page. |
| `npx tsx scripts/check-dwelling.ts 684 30 <home> <png>` | creature behaviour and contact | homes 0/1/2: 0 off ground, 0 in water or trees; foot slip 0.0 cm; muzzle 0.0 cm off the water |

Failure cases met this round and what was done:

- The watching stone on the creature's way (seed 684 after the layout turned): it now keeps 4.5 m
  off the way to every home.
- Trees in water (1–3 per seed): trees keep 4 m from water (the 2 m zone cell was too coarse).
- Page and check built different islands (the panel's turn in whole degrees, 17°, against 0.3 rad):
  the default is now exactly 17°.
- Height-weighted keel moved the underside's deepest point to x ≈ 128 (from 30): rejected; the
  keel is a frame relation (30 m toward the back).

Known issues: the water flags above; the rest mark reads faintly at the home's middle view; the
close view's colour edge soft; legs compress while drinking (accepted); far trees (beyond 90 m) are
Penglai's tiered stand-ins, a little "Christmas tree"; lone pines are few (10–22) and small at the
overview.

## 7. Performance

2026-10-25, Windows laptop, browser pane, canvas 1599 × 834 (dpr 1.25), seed 684, day 30, GPU
time by EXT_disjoint_timer_query (median of 30 renders), triangles by renderer info:

| View | Distance | GPU | Triangles |
|---|---|---|---|
| Overview (default camera) | 626 m | 4.7 ms | 421 k |
| Area: plunge pool and groves | 177 m | 10.6 ms | 550 k |
| Middle: its home (panel "Its home") | 17 m | 7.2 ms | 664 k |
| Close (panel "Close to the ground") | 3 m | 7.1 ms | 714 k |

The woods' share: 0.1–0.2 ms at the overview and area views (trees hidden vs shown), within the
noise. Grown pines to 90 m raised the middle view from 6.5 to 7.2 ms and 318 k to 664 k triangles.
Budget: 60 fps, under 1.5 M triangles. Build in Node: ground + terrace + water 1.5–2.0 s, zones
33–61 ms, woods 3–4 ms; in the page the ground message reports about 3 s (worker, incl. underside).

## 8. Scripts and diagnostics

- Kept project checks: `scripts/check-world.ts`, `scripts/check-water.ts`, `scripts/check-dwelling.ts`.
- No temporary scripts left. `scripts/build-atlas.mjs` is the atlas build (not this work).
- `src/experiments/wonderland-terrain/shots/`: documentation images referenced by the notes; keep.
- Session scratch (frame grabs, probe maps) lives outside the repo and is not needed.
