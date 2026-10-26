# Island v1 — Notes

## Round: Penglai form correction

Goal: move from a noise dome to Penglai's actual form — columnar spires standing on a
broad plateau, cut off by cliffs, over a narrowing rock root — and color it by height
and slope instead of height alone.

### Parameters added

Exactly five. Shape: `plateauRatio`, `cliffSharpness`, `peakCount`; `peakHeight` kept its
name but now means the main column's height (spires are 0.4–0.7 of it, chosen by the seeded
rng). Surface: `meadowLine`.

Everything else that needed a number became a constant in `core/generators/island.ts` or
`core/shaders/terrain.ts` (plateau relief, cliff wall share and taper, root jaggedness,
column radius and wall width, peak gap, face slope, mineral mix).

### What was merged

`edgeFalloff` is gone. It shaped how the height fell off toward the rim, and
`cliffSharpness` now does the same job on the plateau edge band — `pow(edge, cliffSharpness)`.
Two sliders for one curve would fight each other, so only `cliffSharpness` remains.

The `Advanced` folder is also gone; `resolution` sits at the end of `Shape`. Default
resolution went up to 96 so the column walls are not visibly stepped.

### How the terrain structure changed

Top surface, center to rim:

1. **Plateau** — the old warped/ridged fbm with its amplitude cut to a low relief, so it
   undulates instead of forming a dome.
2. **Columns** — one off-center main column and `peakCount` spires, placed by rejection
   sampling with a separate seeded rng stream, with a minimum gap so paths stay open
   between them. Each is a steep smoothstep wall with a flat top, unioned with `max`.
3. **Cliff edge** — beyond `plateauRatio` the ground rolls over by a power curve down to
   the rim.

Underside, rim to tip: a near-vertical cliff wall (30% of the rings) and then an irregular
rock root that narrows to a point. The seam between top and underside is shared exactly.

Limitation: a height field cannot overhang, so column tops cannot flare out; they are flat.

### Surface classification

Slope is `1 - normal.y` from the smooth vertex normal: meadow below `meadowLine`, warm
grey rock above it, a colder, deeper rock face above a fixed steep threshold, and bare rock
on the column tops. Azurite/malachite mixes in only in shadow on bare rock and on the plateau
rim. Lighting still uses the faceted `dFdx/dFdy` normal; classifying with that normal would
flicker per triangle.

`1 - normal.y` is not linear in angle: 0.01 is about 8°, 0.04 about 16°, 0.18 about 35°.
The useful range of `meadowLine` is roughly 0–0.05.

### Class techniques used

- Class 03: fbm heightmap displacement; power shaping curve for the cliff edge.
- Class 05: slope mask `1 - N.y` for the surface colors; smoothstep masks for the column
  walls and the summit band; distance-based falloff for the plateau.
- Class 04 (analogy only): `max` over columns is a union, the same idea as SDF/CSG union,
  applied to height values instead of distances.
- Outside the course: Simplex noise, domain warp, seeded rejection sampling for placement,
  exponential height fog.

### Not done this round

Jointing, mist gullies, thin falls, vegetation and water (Penglai generation steps 3, 5, 7).

## Round: visual fixes (structure unchanged, no new parameters)

- **Columns.** The cross-section radius is now angular fbm plus a softened ridged fold, so
  columns have corners and aretes instead of a round shaft. The wall is a linear ramp over
  the outer quarter of the radius (a slight taper), with a monotonic sine ripple for bulges.
  Spire heights are stratified: each spire draws from its own band of 0.4–0.7, so they
  never come out nearly equal, and taller spires are thicker. Vertical bulges are limited
  by grid resolution; the default went up to 128.
- **Plateau.** Domain warp no longer touches the plateau — it gave the meadow a flow
  direction. `warp` now bends the column outlines, the coastline and the cliff instead.
  Defaults: frequency 1.8 → 1.0, warp 0.4 → 0.1, ridgeSharpness 0.3 → 0.15.
- **Slope colors.** The classification was working; three things hid it. A low dawn sun
  made flat ground count as "shadow", so bare rock was tinted malachite; shadow now means
  facing away from the sun. The cool fill tinted everything grey-green; it is now
  half-desaturated. Meadow and rock were too close; meadow is now darker green-grey, rock
  lighter warm ochre, in all four themes. On the flatter plateau the meadow line moved to
  0.01 (about 46% of the top as meadow).
- **Coastline.** The rim was one smooth fbm, so the bumps were all one size. It is now 65%
  lowest-frequency bays plus warped detail whose strength itself varies along the coast.
- **Fog.** The palette fog color was correct. Linear exponential fog covered the whole
  island at 40–60%, so it read as a flat wash. Squared-exponential fog keeps the near side
  at about 22% and the far side at about 56%.

## Round: fewer parameters, one cliff curve, techniques panel, custom controls

### Parameters removed

- `plateauRatio`. Its visible effect was not the plateau edge (the shoulder only drops
  about 2 units) but peak placement: a small plateau left no room, so spires vanished and
  it read as a second spire count. The plateau edge is now a constant at 78% of the rim,
  columns stand in a fixed zone of 50% of the radius, and a spire that does not fit
  shrinks instead of disappearing. `peakCount` is now the only count.
- `octaves`. Fixed at 7. The plateau relief is ±6% of the radius, so layers past the
  fourth are smaller than a mesh cell; the slider changed almost nothing.
- `warp`. It only roughened outlines, and domain warp is not a class technique. The
  generator no longer calls `domainWarp`; the function stays in `core/noise.ts`.
- Style presets. Only the realistic values remain, as the defaults (ridgeSharpness 0.6).
  With ridged crests the plateau is steeper, so the meadow line moved to 0.05 (about 40%
  meadow).

Defaults: noon (hour 12), fog density 0.01.

### The "thick pancake"

The underside was a near-vertical band of fixed height (40% of the depth, all the way
round) followed by a separate root curve, with a crease where they met. It is now one
curve, radius = (1 − t^a)^0.7 from rim to tip: vertical at the rim, narrowing smoothly,
with no crease. The exponent a comes from `cliffSharpness` and varies ±50% around the
island, so the wall is deep in some places and short in others. The tip drifts off
center. `cliffSharpness` now controls both the shoulder and this wall length.

### Techniques panel

A button on the experiment page opens a panel that walks through the pipeline. Each step
shows its source (Class 03, Class 05, or outside the course), what it does on this island,
which parameters change it, and a live top-down map. The maps come from
`core/generators/islandStages.ts`, which calls the same `createIslandField` functions as
the mesh, so the 2D and 3D cannot drift apart. The step list is `techniqueMap` in
`meta.json`.

### Custom controls (`src/leva/`)

- Sun arc: drag the sun around its arc; the hour is continuous and the palette blends
  between the four keyframes.
- Theme swatches: each theme shown as a strip of its colors at the current hour.
- Curve preview: `cliffSharpness` shows the island's side silhouette; `ridgeSharpness`
  shows the shaping curve.

## Underside as one mass, taper, smoothness, peak spread, meadow by height

### The underside

The previous underside read as a flat bottom with a few sticks: every direction narrowed
the same way, and the noise was sampled along a diagonal sweep (the "pineapple"). Now:

- Every direction starts as the vertical cliff and follows (1 − s^power)^0.7, where
  s = t / reach. `reach` comes from a low-frequency noise mask around the rim (about three
  to five lobes), between 40% and 100% of `undersideDepth`. Short directions retract first,
  so the mass is whole near the rim and splits into fused columns lower down.
- Surface noise is sampled on a circle that widens with depth, so it has no direction.
  Faint horizontal strata (radius varying with depth only) break up the long walls.
- The tip leans toward the longest column instead of a random direction.

Measured on the default island, the mean radius goes 1.0, 0.99, 0.91, 0.78, 0.53, 0.40 ...
in steps of a tenth of the depth; the mass is whole at 30% depth and splits into 4 to 7
lobes by 70%.

### Parameters

- `cliffSharpness` became `taper` (0..1): the narrowing exponent, 5 (blocky) to 1.4 (cone).
  The plateau shoulder now uses a fixed power of 2.5; one slider no longer drives two shapes.
- `smoothness` (0..1): fbm gain 0.5 to 0.3 for the plateau and underside, and half the
  ridge sharpness at 1.
- `peakSpread` (0..1): cluster radius 0.2R to 0.55R and gap 0.02R to 0.1R. A tight
  cluster sits up to 0.2R off center, leaving plain on the far side. No column goes past
  0.55R, clear of the shoulder.
- `meadowLine` is now a height: flat ground (slope below 0.05) under the line is meadow.
  0 is none, 1 includes the main summit. The old summit rule is gone, so spire tops no
  longer turn green before the plateau does. Default 0.35 (about half of the top area).
  The thresholds live in `SURFACE_RULES` so the shader and the technique map agree.

## Underside as one hanging block, peaks as mountains, peak spread that spreads

### The underside

The fused-column underside read as knife cuts: the per-direction `reach` mask let some
directions collapse to zero at 40% depth while their neighbours continued, which cut deep
radial slots, and the strata term added horizontal notches. Both are gone (`columnAt`,
`ROOT_LOBES`/`ROOT_REACH_MIN` as a reach mask, `ROOT_STRATA`, `rootSilhouette`).

A first attempt followed the brief literally (short cliff, fast shoulder, thin stem with a
noise-bent axis). In the browser it read as a wide saucer over a twisted tornado stem. The
owner's reference is a single upright rock block hanging deep below the plateau, walls
close to vertical for the upper half, closing to one off-center tip. The final version:

- Every direction keeps the rim outline and follows `1 − t^a` (Class 03 power shaping),
  times a slight inward lean (12% of the rim over the full depth). The walls stay upright
  and then close to a point.
- `a` varies ±25% around the island from low-frequency angular fbm, so one side closes
  sooner and the block is not rotationally symmetric. Every direction still reaches zero
  only at t = 1, so there are no slots.
- The tip hangs off-center by 0.2R along a t² curve (one lean, no wandering axis).
- Lower-half lobes from angular fbm, vertical ridges from softened ridged angular noise, and
  the existing fine grain. All angular noise is sampled on circles (cos, sin).

Mean underside radius / R per tenth of depth (Penglai preset): 1.02 1.00 0.96 0.93 0.87
0.79 0.68 0.55 0.40 0.22 0.00, monotonic, largest step per ring 0.018. At taper 0 the
walls hold 0.94 at half depth; at taper 1 it is 0.74. Seam gap 0.

Parameters: `taper` is now the exponent `a`, 4 (taper 0) to 1.6 (taper 1), a plain slider
(the curve preview was removed; the `curve` plugin stays for ridgeSharpness).
`undersideDepth` defaults: `DEFAULT_ISLAND` 16 → 32, Penglai preset 20 → 35 (about 1.6R).
The ring count along depth is unchanged; 128 rings over 35 units was enough.

### Peaks

Flat-topped columns read as wooden stakes. Each peak is now `h · (1 − d/outline)^2.2`
(Class 05 distance mask, Class 03 power shaping): steep upper flanks, a foot spreading
into the plateau, and a summit rounded by a soft distance `sqrt(d² + r²) − r`. The base
radius went from 0.13R to 0.3R for the main peak (spires 0.45–0.8 of it). The outline is
angular fbm plus softened ridged angular noise, so every contour is a star and spurs run
from summit to foot. The sine ripple and the wall taper are gone. Peaks merge with a
polynomial smooth max (Class 04 `smin`), width 0.2 × peakHeight; the width shrinks to
a + b so bare plateau is not raised. Placement checks only the summit core (0.3 of the base
radius) against other summits and the limit, so feet may overlap and share saddles.

Meadow share on the Penglai preset: 41%; grid cells higher than 0.3 × peakHeight that are
meadow: 0 of 351.

### Peak spread

The limit is now a fraction of the actual rim at the peak's angle, 0.4 at spread 0 to 0.82
at spread 1; the cluster radius goes 0.2R → 0.95R and the gap 0.02R → 0.12R, sampled with
`sqrt(rng())`. Farthest summit / R, mean over seeds 1–8: 0.36 (spread 0), 0.50 (0.5),
0.71 (1). Going further would put summits on the rolled-over shoulder.

Generation time about 100 ms cold, 83 ms warm; deterministic; no NaN at the extremes of
taper, smoothness, spire count and a small, shallow island.

### Underside, second pass: hanging rocks

In the browser the single `1 − t^a` block read as a clean chunk that had broken off, closing
to one point. The owner wants the bottom to break into a few large, blunt rocks at different
depths, with notches between them (drawn as a red outline over a screenshot). A polar
radius per depth ring cannot show two separate rocks at the same depth, so the underside is
now an inverted height field over the plateau disc:

- Wall: depth `(1 − ρ^n)^0.5` (vertical at the rim) plus a gentle slope toward the center.
  n varies around the island with broad fbm, ridged angular noise and grain, which cuts
  vertical ridges into the wall. Scaled down when undersideDepth is less than the radius.
- Hanging rocks: inverted peaks, depth `h · (1 − u^p)^q` over their footprint, with the same
  kind of wobbly, ridged outline as the top peaks. One main rock (footprint 0.5R, 0.08–0.25R
  off center) reaches undersideDepth; the others (0.28–0.4R) hang 0.5–0.8 of it, stratified,
  placed by seeded rejection so they overlap but stay distinct. They fade out near the rim.
- Everything merges by smooth max (Class 04 smin), width 0.25R, plus large fbm lumps.
- Mesh: each ray from rim to center is sampled at 2 × 256 points and resampled to 256 rings
  at equal arc length, so the steep sides get rings too (longest ring edge 0.34–0.48 units).
  The angular segments match the top, so the seam is shared exactly; all rays end at the
  same center point.

Parameters: new `rockCount` (Shape, 1–6, Penglai 3). `taper` now shapes the rocks: p 3 → 1.6,
q 0.35 → 0.8 (0 blunt blocks, 1 tapered). `undersideDepth` slider max 40 → 100; defaults
`DEFAULT_ISLAND` 45, Penglai 50 (about 2.3R); Penglai taper 0.6 → 0.2.

Measured (Penglai): seam gap 0, center spread 0, lowest point 53 (depth 50 plus lumps),
meadow 41%, deterministic, no NaN for seeds 684/12, taper 1 with 5 rocks, 1 rock, and a
small shallow island. Generation time rose to about 150 ms (was about 100 ms) because of
the denser underside.

### Underside, third pass: joins (the "upside-down cactus")

With q < 1 the rocks had vertical sides all the way up and plugged straight into a flat
ceiling under the rim, and their ridges ran as evenly spaced full-length ribs, so they read
as an upside-down cactus. Changes:

- Rock profile q 0.35–0.8 → 1.5–3 (p 3–1.6 → 3–2): the root flares into the rock above,
  the section narrows steadily and the bottom stays blunt.
- No flat ceiling: the center slope `CEILING_SLOPE (1 − ρ)^1.2` went 0.35 → 0.7, and the
  smooth-union width 0.25R → 0.6R, so wall, mass and rocks read as one body.
- Ribs: rock ridge depth 0.18 → 0.08, blended between two ridge patterns from root to tip,
  plus position fbm on the outline (0.15), so ridges start and stop. Wall ridges 0.5 → 0.3.
- Rocks larger (main 0.5R → 0.55R, side 0.28–0.4R → 0.3–0.42R), reach 0.8 → 0.85 of the
  rim, spacing 0.6 → 0.45 summed radii, so side rocks still fit.

Side silhouettes (ASCII, lowest point per column) now narrow continuously from the rim,
with side rocks splitting off in the lower half and a blunt bottom. Generation time about
190 ms on Penglai (220 ms with 6 rocks at depth 100); seam and center closed, no NaN.

## Owner preset, camera framing, techniques panel rewrite

- **Preset.** `penglai.json` is now the owner's exported preset: radius 31, taper 0,
  peakHeight 7, peakCount 4, peakSpread 0.75, undersideDepth 38, rockCount 4, fogDensity 0.
- **Camera.** The orbit target was fixed at y = 2, near the plateau, and the zoom stopped at
  140, so long hanging rocks fell out of frame. The target now sits halfway between the
  summit and the deepest rock, `(peakHeight − undersideDepth) / 2`. With an island size of
  `hypot(1.3 · radius, (peakHeight + undersideDepth) / 2)`, the first view starts 2.6 sizes
  away and the wheel reaches 6 sizes (at least 140; about 280 on the preset). The start
  position is only read when the canvas is created, so sliders do not move the camera.
- **Underside in the field.** `wallPower(angle)`, `depthAt(...)` and `rocks` moved from
  `createIsland` into `createIslandField`, so the techniques panel can draw the underside
  from the same functions. The mesh is unchanged.
- **Techniques panel.** Eleven steps in run order: seed, simplex, fbm, ridged, plateau,
  peaks, smooth union, hanging rocks (new, with a live depth map), slope, rim light, fog.
  Each has a tag (a class as taught, "derived from Class N", or outside the course), a
  plain "what it does" line and a short "how" line. `TechniqueEntry` gained `derived`.
  The old `columns` and `heightfield` entries were split into plateau, peaks, smooth union
  and hanging rocks.

## Thin falls (Penglai generation step 7)

- **Generator** `core/generators/waterfall.ts` (pure, seeded with its own salt). Rim angles
  are scored by how far the rim pulls in (bays, where water gathers) plus a seeded random
  term, then picked greedily at least 0.6 rad apart. Each fall is two crossed ribbons (one
  facing out from the cliff, one edge-on), 48 rows, leaving the rim 0.015R outside it and
  curving out as `0.25 · sqrt(drop)` like water off a ledge, with a slight noise sway. Width
  0.035R at the lip, three times that where it dissolves; length 0.5–0.75 of undersideDepth
  (at least 8 units).
- **Shader** `core/shaders/waterfall.ts`: value noise stretched along the ribbon and scrolled
  down with `uTime` (derived from Class 05 uniforms and noise). A threshold that rises with
  distance down frays the thread into strands, then vapour. Colors are existing palette
  entries only (rim highlight for water, fog color for vapour), so the falls follow theme and
  hour. Transparent, no depth write, double-sided.
- **Parameter** `fallCount` in Surface (0–6, Penglai 3), with a bilingual hint; new
  techniques step "Thin falls" (derived from Class 05).
- First try used a fixed 0.35-unit width: on the radius-31 preset that was under two pixels
  and could not be seen. Widths and offsets now scale with the radius.
- Measured: deterministic, no NaN, generation under 1 ms; every fall vertex is outside the
  island outline (closest 1.005 × rim), so no fall cuts into the cliff or the hanging rocks.
  Checked in the browser: no shader errors, falls visible.

## Colors faithful to the palette, fog removed, falls longer, clearer techniques

- **Why the colors looked washed out.** Computing the terrain shader by hand for the default
  backlit view (qinglv, noon) gave: flat meadow `#67805e` shown as `#d0d5b0` (3.4× brighter),
  flat rock `#d2c3a2` as `#ffffda` (clipped), camera-facing cliffs at 0.4× and grey-blue.
  Three causes: (1) the Fresnel rim light, meant for silhouettes, also lit flat ground, which a
  low camera sees edge-on, adding near-white on top of the meadow; (2) fill plus key light
  could sum well above 1; (3) all rock facing away from the sun took 35% mineral pigment.
- **Fix** (`shaders/terrain.ts` only; palette untouched). The lights keep only their palette
  tint, at unit brightness (the palette already darkens dusk and night object colors, so the
  light must not darken them again). Ambient 0.65 and key 0.55 of the palette color; rim light
  masked to faces that are not facing up (`1 − smoothstep(0.5, 0.9, N.y)`); mineral 0.35 on
  the plateau rim, 0.12 in shadow. Displayed / palette brightness now: flat tops 0.94 at noon
  (meadow `#607d5c` for `#67805e`), 0.75–0.87 at dawn, dusk and night; slopes and cliffs facing
  the camera about 0.55–0.6, still cool-tinted. Same in the Dunhuang theme.
- **Fog removed** at the owner's request (the preset already had it off): the `fogDensity`
  control, `SceneParams.fogDensity`, the fog uniforms and `fogAmount` are gone, as is the
  techniques entry. The cloud sea still needs to melt into the sky far out, so it now blends to
  the sky's horizon color between 300 and 750 units from the camera; that is its only use.
  The palette's `fog` color is still used for the cloud sea and the falls' vapour.
- **Falls** 1.25× longer: 0.625–0.94 of undersideDepth (minimum 10 units).
- **Techniques panel**: every card now has three labelled lines, "what it is", "where" (which
  part of the island uses it) and "how", written for someone who has not taken the course.
  Checked in the browser; no console errors on a fresh load.

## Meadow line fixed, three new themes, rock pools

- **Meadow line stopped at 0.5.** It mapped 0..1 onto heights from below the plateau to
  above the main summit, which made sense for flat-topped columns. The new peaks have no
  flat ground above their feet, so once the line passed the highest plateau (about 0.35) the
  rest of the slider did nothing: meadow share went 0% → 44% between 0.1 and 0.35, then stayed
  at 44%. A fixed height span per radius was tried and still left dead ends at both sides.
  Now `meadowLine` is the share of the flat ground that is meadow, lowest first:
  `flatGroundHeights` samples the top on a 4096-point sunflower pattern (about 9 ms), keeps
  heights where the slope is under `grassSlope`, sorts them, and `meadowLineHeight` takes the
  quantile. The shader gets it as `uGrassLine` (world height; `uPeak` is gone). Measured meadow
  share per 0.1 of the slider: 0, 4, 8, 12, 16, 21, 25, 29, 34, 39, 44% — even all the way.
  Preset 0.35 → 0.9, which looks like the old default.
- **Themes.** Three livelier palettes, all four times of day: Peach Blossom Spring
  (`taoyuan`: turquoise sky, fresh green, apricot stone, peach accent), Golden autumn
  (`jinqiu`: deep blue sky, amber grass, red sandstone, turquoise cracks, maple accent) and
  Glazed tile (`liuli`: lapis sky, emerald meadow, white-jade stone, glaze-teal cliffs, gold
  accent). None has a pink or magenta sky. Order: qinglv, taoyuan, jinqiu, liuli, dunhuang,
  shuimo, guixu.
- **Rock pools** (`generators/pools.ts`, `shaders/pool.ts`, Surface `poolCount` 0–8,
  Penglai 4). Local minima of the top surface on a 40-cells-per-radius grid (lower than all
  16 neighbours one and two cells away), on the open plateau (inside 0.7 of the rim, off the
  peaks), scored by depth plus a seeded random term, kept 8 cells apart. The water level fills
  80% of the hollow's depth; along 40 directions the sheet runs out until the ground rises above
  the water, so the shore follows the stone. Shader: faint time-driven ripples, a Fresnel
  mix from dark mineral depth (seen from above) to the palette sky gradient in the reflected
  direction (seen edge-on), a sun glint, and a soft shore fade. Measured: deterministic, no
  NaN, 9–16 ms, pools reach 1–2 units on the preset, no shore vertex over lower ground (no
  floating water), inner water under the ground in 3 of 480 vertices on one small island only.

### Rock pools, second pass: carved bowls, a readable shader

In the browser the pools were dark dots about one unit across; natural hollows on this
plateau are too shallow and small, and from above the Fresnel mix showed almost only the dark
depth. Changes:

- **Carved.** Pools are placed on the uncarved ground (local minima lower than their 8
  neighbours, bowl fully on open plateau, off the peaks, inside 0.65 of the rim), then a bowl is
  cut into the heightmap: flat out to 0.55 of its radius, rising by smoothstep to the rim. Bowl
  radius 0.06–0.1R. The water level is 0.05 below the lowest point of the bowl's rim, so a pool
  can never spill, and the bowl is 0.35 deeper than that at its center. Because this changes the
  terrain, `poolCount` moved from `SurfaceParams` to `IslandParams` (Shape folder), and
  `createIslandField` exposes `pools`; `heightAt` and `top` include the bowls, so the mesh, the
  maps, the meadow line and the falls all see them.
- **Shader.** Fresnel floor 0.2 → 0.45, so the sky reflection shows from a high camera; depth
  gradient from dark mineral in the middle to rock color at the shallow shore; a bright wet band
  just inside the shore; ripples 3× stronger; sun glint sharpness 300 → 60; drifting sparkles.
- **Measured** (Penglai preset): water radius 2.0–2.9 units (was 1.0–1.6), bowls 2.2–2.9; with
  8 requested, 6 fit. No floating shore vertices, no water under the ground, deterministic,
  field creation about 15 ms. Checked in the browser: pools read from above, no console errors.

## Pools in the Surface menu, all pools placed, finer mesh, eight technique cards

- **Menu.** The pool slider is back in Surface with the other water. The value still belongs
  to `IslandParams` (it carves the ground); `controls.ts` merges it into the island params and
  the preset export reads it from `Surface.poolCount`.
- **Count.** With 8 requested only 5–7 pools appeared: candidates had to be strict minima
  (lower than all 8 neighbours), and a bowl that did not fit was dropped. Candidates are now
  any point lower than the mean of its 8 neighbours, ranked by that difference, and a bowl that
  does not fit is tried again at 0.8 and 0.64 of its size. Spacing 1.6 → 1.3 summed radii, search
  area 0.65 → 0.72 of the rim. Measured: 8 of 8 on seeds 684, 1, 12, 99, 2024, with 8 spread-out
  peaks, and on small islands; still no floating or buried water.
- **Resolution** slider maximum 160 → 256. Measured on the preset: 128 rings 210 ms (295k
  triangles, top cells 0.24 × 0.51 units at the rim), 192 rings 440 ms, 256 rings 780 ms
  (1.18M triangles, 0.12 × 0.25). The hint states the cost.
- **Techniques panel: 12 cards → 8.** Simplex, fBm, ridged shaping and the plateau became
  one "Terrain relief" card with four maps side by side (captions Simplex, fBm, Ridged,
  Heightmap) and a numbered "how" that says what each step adds to the previous one. Smooth
  union no longer has its own card; the peaks and hanging rocks cards each explain it where it
  is used (still credited to Class 04). `TechniqueEntry.stage` became `stages` (a list).
  Cards: seed, terrain, peaks, hanging rocks, thin falls, rock pools, slope, rim light; every
  card's title, what, where and how are present in both languages (checked by script).

## Smoothness removed, bigger pools, three themes, a bluer blue-green

- **Smoothness** is gone (the owner had it at 0). fbm gain is fixed at 0.5 (`FBM_GAIN`), which
  is what smoothness 0 gave, so the island is unchanged.
- **Pools** bowl radius 0.06–0.1R → 0.09–0.14R. Preset water radius now 2.2–3.6 units; 8 of 8
  still fit on seeds 684, 1, 12, 2024, with 8 spread-out peaks and on a small island; none
  floating or buried.
- **Themes** cut to three: qinglv (retuned), liuli, guixu. Taoyuan, jinqiu, dunhuang and
  shuimo are removed, with their labels.
- **Why blue-green looked dusty grey.** From the usual low camera the visible sky is mostly
  the horizon-to-mid band, which was cream and grey-teal, so the sky never read as blue. On the
  island, almost everything the camera sees is lit only by the fill (the sun is behind), and a
  50% blue fill on warm ochre stone cancels to grey: flat rock showed at saturation 25 for a
  palette 46, slopes at 11, and the cliff color itself was a neutral grey.
- **Fix.** Qinglv now sits between the old blue-green and peach-blossom: azure mid sky
  (`#6cbde0` at noon) and a slightly blue horizon, spring-green meadow (`#5e9452`), warmer
  ochre stone, light warm-ochre cliffs (`#a39070`) instead of grey, bluer shadow light. The
  terrain fill keeps 25% of the shadowCool hue instead of 50% (all themes): shadows are still
  cool, but warm stone keeps its hue. Measured at noon: meadow shown at saturation 28 (was 15),
  flat rock 35 (was 25). Liuli and guixu keep their cool look.

## Seam blend, dreamier cloud sea, lower sky, plainer technique text

- **Seam.** The plateau and the underside are separate meshes that meet at the rim. Two things
  jumped there: the rim weight (`aRim`, which drives the mineral tint) was 1 on the top ring and
  0 on the underside, and the slope class switched from rock to rock face at the crease. The
  underside rim weight now starts at 1 at the seam and fades out over 0.12R of depth
  (`SEAM_BAND`), and the terrain shader blends both sides toward one stone color (halfway
  between rock and rock face) within that band around `uRimY`. The line became a gradient.
- **Cloud sea.** Two palette colors per theme and time: `cloudLight` (warm gold) and
  `cloudShade` (soft lavender in qinglv and liuli, cold teal in guixu). Crests that catch the
  light, chosen by the existing cloud noise plus a large, slow swell, are gold; troughs are
  lavender. Looking toward the sun the whole sea warms and the crests shine. Lavender is only in
  the clouds; skies still avoid pink and magenta.
- **Sky.** From the usual slightly-downward view the sky showed mostly its horizon color. The
  mid sky is now reached 0.12 above the horizon (was 0.22) and the top by 0.6 (was 0.75), and a
  broad band of `cloudLight` sits along the horizon under the sun. Below the horizon the sky
  fades to `cloudShade` instead of the fog color, to match the sea.
- **Techniques.** The intro now defines mesh, shader and noise in one sentence each. The falls
  card explains the two parts separately: the mesh (two still, crossed strips) and the shader
  (a streaky noise pattern slid down every frame with a time value).

## Bigger islands, renamed study, Ideas page, updated world docs

- **Radius** slider maximum 40 → 120, room for creatures and buildings later. Radius 120
  generates in about 220 ms with no NaN and all pools placed. The mesh density is per ring, so
  at radius 120 and resolution 128 a top cell is about 0.94 units; large islands want a higher
  resolution.
- **Sky and cloud sea follow the camera.** With the zoom reaching six island sizes, a large
  island's camera could leave the 900-unit sky sphere and the 1600-unit cloud plane. Both now
  move with the camera every frame; their shaders read world positions, so nothing slides.
- **Name.** The study is now "Penglai Island v1" (zh "蓬莱 Island v1"); the summary no longer
  mentions height fog.
- **Ideas page.** Image-led: the owner's five-islands concept art, a short intro, where the ideas
  come from (Liezi, Shanhaijing, painting and game light, each with one link), the mood board,
  and two concept panels side by side, then a link to the Atlas. Images live in
  `src/content/ideas/` and are bundled by Vite; they are references, not world content.
- **World docs.** `penglai.md`: natural peaks instead of columns, a section on the underside,
  pools and falls as built, the three palettes, why fog was removed, and the generation steps
  with their status. `world-concept.md`: the Penglai rule row, "Fog and cloud" instead of fog
  as the key effect, and a short "How the World Is Built" (height fields, not voxels; themes).

## Cloud sea no longer cuts into the island

The cloud sea sat at `-(undersideDepth + 6)`, but the mesh reaches lower than undersideDepth:
the rim itself is at `-0.1R`, and the hanging rocks carry lumps. On the preset the lowest rock is
at -44.5 and the clouds were at -44.0, so the island's tip was buried; at radius 120 the rocks
reached -77 against clouds at -44. The cloud sea now sits below the mesh's bounding-box
minimum, by at least 6 units and at least 0.2R (preset: clouds at -50.7).

## Grass and wind

- **Where** (`generators/grass.ts`, pure). `grassSites` samples the top on a 160-cell square grid,
  takes slopes by central differences, and scatters jittered sites in each cell (about 30 per
  square unit, capped at 120k sites per island; larger islands get fewer per cell), with height
  and slope interpolated from the cell corners. Sites in pool bowls are skipped. `placeGrass`
  keeps a site with the probability the terrain shader gives that spot of being meadow (the same
  slope and meadow-line smoothsteps; `lineBlend` moved into `SURFACE_RULES` so both read one
  value) times `grassDensity`. Sites are computed once per island; the meadow line and density
  only filter, so those sliders stay fast.
- **Shape** (`shaders/grass.ts`). One tapered blade of 4 rows, drawn with instancing; each
  instance carries its root position and yaw, height, lean and shade. Blade height is
  `0.25–1.4` units at `grassHeight` 0–1 on a radius-31 island and scales with the radius.
- **Wind.** One wind field lives in the shared GLSL (`windAt`): gust patches of noise rolling
  along a fixed direction plus a faster flutter, scaled by `uWind` (Atmosphere > Wind). The
  grass vertex shader pushes each blade by it, growing with t², and shortens bent blades so tips
  do not stretch. Later sway (flowers, trees, clouds) can use the same field.
- **Color.** Palette meadow only: darker at the root, lighter at the tip, per-blade shade, the
  terrain's light levels, and backlit tips that let the sun through. The painted meadow stays
  underneath, so gaps never show bare rock.
- **Measured.** Preset: 89k sites in 46 ms, 18.5k blades (5 ms to filter), deterministic, no
  NaN, none in pools; at the mesh's scale 6% of blades stand on slopes just above 0.1 (the thinning
  edge of the meadow) and none above 0.3. Radius 120: 28k blades. Browser: no shader errors,
  about 83 fps.

## Pool shores, wider falls

- **Tongues.** Some pools ran a long strip of water out over a channel. The level came from the
  lowest of 24 samples on the bowl's rim, so a dip narrower than the gap between samples was
  missed; a ray along that dip never met the shore and ran to the bowl's full radius. Rim samples
  24 → 96, and a ray that never meets the shore now takes its nearest neighbours' reach.
- **Hard shore line.** The fade was by distance from the center (`aShore`), not by where the
  water meets the ground, so the intersection with the stone showed as a line. Each vertex now
  carries `aDepth`, the water depth over the ground (negative past the shore); the shader fades
  over the last 0.06 units of depth, shows the stone through water shallower than 0.35, and puts
  the wet band where the water barely covers the stone.
- **Measured** over 40 seeds × 8 pools (320 pools): 3 outer-ring vertices still slightly
  visible (depth 0.07), one ray reaching well past its neighbours (a real narrow cove).
- **Falls** lip width 0.035R → 0.06R (about 1.7×; 1.9 units on the preset).

## Painted peaks, Zhuyu flowers, course reference

- **Course reference.** The syllabus is condensed in `final_project/docs/course.md` (aims, session
  topics and dates, deliverables, rubric); `final_project/CLAUDE.md` points AI sessions to it and
  to the other docs.
- **Peaks painted the blue-green way.** In blue-green landscape painting the mountain is laid in
  ochre, then malachite and azurite are glazed onto its upper parts; the Liezi says the five
  mountains' terraces are "all gold and jade". The terrain shader now colors bare rock by its
  height as a share of the main peak: ochre at the foot, malachite from 0.3–0.6, azurite
  (`peakTop`, a new palette color per theme and hour) from 0.5–0.88, and a touch of the rim color
  as jade white above 0.9. Noise shifts the bands so they do not read as contour rings. Meadow is
  untouched. Shorter spires only reach malachite, as in the paintings.
- **Zhuyu flowers** (`placeFlowers` in `generators/grass.ts`, `shaders/flowers.ts`). They reuse
  the grass sites (each site now carries 6 random values). A site holds a flower with the chance
  meadow × density × 0.1 × max(clump, shore): clumps from low-frequency noise, and a bonus within
  1.8 pool radii of a pool. Each flower is a thin stem and five petals, instanced, swaying in the
  shared wind. `flowerPhase(hour)` (in `params/scene.ts`) gives bloom and glow: open by 7:00,
  folding from 16:30, glowing from 17:00, fully glowing by 19:30 until dawn. Bloom hinges the
  petals in the vertex shader; glow adds the palette rim color (pale cyan at night) in the fragment
  shader. Colors: palette accent by day, rim color at night.
- **Measured.** Preset: about 500 flowers at density 0.5 (1,000 at 1), deterministic; flowers are
  2.4× denser near pools than on average. Browser: no shader errors; at midnight the flowers show
  as pale cyan points across the meadow.

## First-person walk, per-peak painting

- **Walk replaces cruise.** The owner wanted to travel on the island, not circle it. Camera >
  Walk puts the visitor on flat meadow near the main peak, facing it. A click on the 3D view
  locks the mouse (drei `PointerLockControls`, limited to the island canvas so panel clicks and
  technique maps do not lock it); WASD or the arrows move, Shift runs (2.5×), Esc frees the mouse,
  turning Walk off returns the orbit camera to its start. A one-line key hint shows at the bottom.
  While walking the sun stays at a fixed azimuth (ahead and a little to the side at the start), so
  turning around shows backlight and front light; the near plane drops to 0.05 so grass right in
  front is not clipped. Keys only steer while the mouse is locked, so typing in the panel is safe.
- **Rules** (`core/walk.ts`, pure). Feet follow the ground; in a pool they sink 0.35 under the
  surface (wading). A step is refused if it leaves the island, passes 0.97 of the rim (the visitor
  stops at the cliff edge), or climbs steeper than rise/run 1 (about 45°; downhill is always
  allowed); a refused move slides along whichever axis is free. Speed eases in and out (rate 8/s),
  the eye eases to feet + 1.7 (rate 10/s); lengths and speeds scale with radius / 31. Frame steps
  are clamped to 50 ms. Tested headlessly: a random walker over 20,000 steps on five islands never
  left the island, passed the edge, climbed over the limit or dropped its eye into the ground; it
  reaches the foothills and lower flanks (feet up to 3.8 on a 7-unit peak) but not the summits.
- **Memo fix.** `controls.ts` built the island params as a fresh object on every render (since
  `poolCount` moved to the Surface menu), so every render regenerated the island (~200 ms). The
  island and surface params are now memoized on their serialized values.
- **Per-peak painting.** The owner noticed only the main peak reached azurite. `peakTone` gives
  each top vertex its rise on its own peak (0 foot, 1 summit) and that peak's prominence (height /
  main height), blended across saddles by each peak's contribution squared; stored as `aPeak`.
  The shader paints by rise, so every peak gets ochre → malachite → azurite, with azurite scaled by
  0.35–1 of prominence and the jade tip only on peaks above 0.75 prominence. `uPeakHeight` is gone.
  Summits measure rise 1.00 and feet 0.00; the island mesh takes about 250 ms (was about 200).

## Midterm round (2026-10-12): scale, camera, pines, wind field, solar terms

Prompted by the midterm feedback (grass too tall next to the peaks; the camera clipping into the
ground) and by the owner's wish to bring Sessions 6 and 7 onto the island.

- **Grass scale.** Blade height at grassHeight 0..1 went from 0.25..1.4 to 0.1..0.6 world units
  (about metres) on a radius-31 island: the default is now about 0.35, shin height for a 1.7 eye,
  next to 7-unit peaks. Flower heads were 0.25 of the blade; now 0.55, so they keep their old size.
- **Camera collision** (`core/camera.ts`, pure). After the orbit controls move the camera each
  frame, `clearHeight` checks it against the top surface and the underside at its (x, z), out to
  1.03 of the rim; inside the rock or within 1.5 units (scaled by radius / 31) of it, the camera
  is moved out through the nearer surface. Walking already kept the eye 1.7 above the feet.
- **Pines** (`core/generators/pine.ts`, `core/shaders/pine.ts`, `Pines.tsx`; Class 07). The Class 07
  welcome-pine grammar (stochastic rules, 7 generations, golden-angle roll, gravity) grown with
  createRng; four seeded variants per island. Placement: 1,500 candidate spots scored by height on
  a peak, closeness to the rim and rockiness, none in pools or on slopes over 1.3, drawn by score
  with a 4-unit gap; trees past 0.8 of the rim lean out 0.15–0.35 rad. Scale 0.46–0.72, so a pine
  stands about 4–7 units: a scale reference for the whole island. LOD: three meshes per variant cut
  by recursion depth (every twig; twigs merged into one pad per limb; trunk plus one pad per limb),
  switched by three.js `LOD` at 28 and 75 units (scaled). Evergreen colours from `TREE` in the
  palette; lit like the terrain; `uSnow` lays snow on the tops of the pads. Default 12 (`pineCount`).
- **Wind as a vector field** (`core/generators/wind.ts`; Class 06). A 48 x 48 grid over 1.4 radii:
  the prevailing wind along WIND_DIR, plus for each peak ideal flow past a cylinder of 0.7 x its
  base radius (speed-up on the flanks, slow in front), a wake behind it (up to 60 % calmer), plus
  curl noise at 0.12 (at 0.35 the eddies turned the streaks into loops). Packed into a 48 x 48
  RGBA8 texture (-2.5..2.5) that `windAt` in the shared GLSL samples, so grass and flowers sway with
  the local wind; gusts and flutter now follow the local direction. **Show wind** draws 900
  particles reading the same field each frame, with 14-point trails sampled every 0.05 s (one
  ground lookup per new point, not per frame).
- **The 24 solar terms** (`core/season.ts`, `SeasonBar.tsx`). The year is a number 0..24 from the
  Start of Spring (Feb 4), 15.2 days per term; it opens on the current term (Oct 12 → 16.4, Cold
  Dew). Rules: green rises 惊蛰→立夏 and fades 处暑→霜降; gold rises 立秋→秋分 and fades by 立冬;
  snow comes 小雪→冬至 and melts by 雨水; flowers are in season 惊蛰→白露; the sun is up to 9° higher
  at the Summer Solstice and lower in winter. The meadow colour (terrain and grass both read
  uMeadow) goes straw → theme green → gold → half under snow; grass is 45–100 % of its height;
  terrain snow comes down each peak from the summit as uSnow grows. The bar under the island can be
  dragged through 24 ticks, or played (one year in 120 s, checked at about 0.2 terms per second);
  "Today" jumps back. Checked in the browser at Cold Dew (gold), Minor Cold (snow on peaks and
  pines, straw meadow) and Grain in Ear (green).

## Midterm round, part 2 (2026-10-13): view, grass, silk panels, footpath, pavilion

- **Default view** about 35° above the horizon (was about 10°), so the top of the island reads.
- **Grass density** doubled once the blades were shorter: 60 candidate sites per square unit
  (cap 250,000, was 30 and 120,000); blades 0.14 of their height wide (was 0.10).
- **Silk panels.** On the experiment page the UI colour variables become `SILK_UI` (translucent
  silk, ink text, cinnabar accent) with a backdrop blur, and leva gets the same theme; the site
  header stays ink. The panels now match the atlas and the class apps instead of a dark tech UI.
- **Footpath** (`core/generators/path.ts`, `Path.tsx`; Class 06 paths). Landing: the gentlest of
  64 spots at 0.9 of the rim. Lookout: the highest grid cell with slope under 0.12, at least half
  a radius from the landing. A* on a 96 x 96 grid, step cost = length x (1 + 25 x grade²), pools and
  grades over 0.9 blocked; Catmull-Rom through every second cell, resampled every 0.6 units and
  draped on the ground; grade over 0.22 → steps. Flagstones (2–3 per sample, instanced
  dodecahedra) and step slabs (instanced boxes) use a new prop shader lit like the terrain. Grass,
  flowers and pines avoid the path (half its width + 0.15) and a 4-unit circle at the lookout.
- **Pavilion** (`core/generators/pavilion.ts`, `Pavilion.tsx`). A shape grammar: plinth (one
  stone per side + centre slab), three steps facing the arriving path, six columns, six beams, six
  concave roof panels with corners lifted (flying eaves), a gilt finial: 30 blocks, each with its
  place in the rule order. They drop in 0.16 s apart and settle in 0.55 s with a small bounce;
  **Build the pavilion** (Surface) replays it. Colours from `PROPS` in the palette.

## Midterm round, part 3 (2026-10-13): paper panels, drawn paths, varied pavilions

Owner feedback on part 2: grey text on the translucent silk and ink lettering on the cinnabar
button were hard to read; the pavilion was one fixed building with an animation, not procedural;
the path looked preset because the visitor had no say.

- **Panels, version D** (chosen from four mock-ups). Opaque paper (#f3ecdc) with a light SVG grain,
  every label and value in ink (no grey), 1.5 px ink borders with a small offset shadow, ink
  buttons with paper lettering (leva's buttons forced to paper text), ink slider fills. Cinnabar
  only in small marks: the step numbers, a diamond on the Techniques button and the active tool.
- **Drawn paths.** `routePath` takes any two points (clicks snap to the nearest walkable cell);
  the first path keeps its automatic ends. Draw a path (bottom left): click a start (a cinnabar
  marker), click an end; the route comes from A* as before. Cells on an existing path cost 0.35 of
  fresh ground, so new paths join old ones and a network grows. Grass and flowers keep off every
  path and pavilion (a 256 x 256 mask instead of scanning points); pines only avoid the first path
  so they do not move while drawing. Clear paths removes the drawn ones.
- **Every path ends in a pavilion, each different.** The grammar's numbers come from a seed: 4, 6
  or 8 sides, column radius 1.3–1.8 and height 2–2.8, roof height 1.2–2.1, eave lift 0.25–0.65, and
  a double eave 35 % of the time (Roof → lower skirt to an inner ring + upper roof).

## Midterm round, part 4 (2026-10-13): bridges, the search made visible, static pavilions

- **Pavilions** are static again (the owner felt the build animation was not procedural); the
  double eave had a gap between the lower skirt and the upper roof: a wall (beam colour) now runs
  from inside the skirt to above the upper eave.
- **Bridges.** A* may leap 2–12 cells in a straight line when every cell between is a pool or lies
  more than 1 unit below the deck, and the deck grade is under 0.3; a leap costs 1.4 x its length
  + 3, so it is taken only where going round costs more. The route splits into walked runs
  (smoothed) and bridges (straight); bridge samples follow the deck. Kind: over water a stone arch
  up to 7 units, over a gully a stone arch up to 3.5, else a rope bridge. A path across the left
  pool on Penglai came out as a 6.1-unit span (rope before the water rule, arch after it).
  Stone arch: deck slabs with a hump of 0.1 x length, a ring of arch stones dropping 0.35 x length
  toward the banks, posts on both sides. Rope bridge: four posts, planks sagging 0.08 x length,
  hand ropes as short cylinder pieces.
- **The search made visible.** A* records the cells it settles, in order. A new path first shows
  them as ink dots (0.8–2.5 s, up to 6,000), then lays its pieces from start to end (0.03 s per
  sample: flagstones, steps, bridge parts, all instanced and revealed as a prefix), then the dots
  fade over 1.2 s.

## Midterm round, part 5 (2026-10-13): guided paths, fewer pavilions, arch bridges only

Owner feedback: the search dots covered the whole island and looked bad; the island should open
by guiding the visitor; rope bridges came up too often (the ground is uneven) and had only two
ropes; a pavilion on every path was too many.

- **No search dots.** A* no longer records the cells it settles; a new path is simply laid from
  start to end (0.03 s per sample).
- **Guided start.** No path is drawn on load and the path tool is on. A prompt at the top shows
  three steps (pick a start, pick an end, the path is laid) with a pulsing cinnabar dot while it
  waits; after the path is laid it says whether a pavilion was built.
- **Pavilions only where they make sense** (`worthAPavilion`): slope under 0.2 at the end, a view
  (past 0.75 of the rim or higher than 0.4 x peak height), at least 10 units from another, at most
  four. The pavilion appears when the stones reach it.
- **Bridges are stone arches only.** A gully counts only if the ground is 2.5 units (was 1) below
  the deck, and a span is at most 7 units.
- **Techniques panel trimmed** from 15 cards to 13: Seeded randomness folded into the intro (and
  the seed slider listed under Terrain), Rim light merged into the colour card; the intro is two
  sentences; the path, pavilion, pines, wind and seasons texts were shortened.
- **Follow-up: friendlier pavilions.** The two-point slope test (0.8 units apart) read small bumps
  of the heightmap as too steep, so flat-looking ends rarely got a pavilion. The slope is now the
  mean over a 3-unit patch (threshold 0.25), the view test is past 0.7 of the rim or above
  0.3 x peak height, and a click is an intent: `pavilionSiteNear` searches a 4-unit disc (13 x 13
  samples) for the nearest spot worth a pavilion, and the path ends there. Prompts are positive:
  before the second click they say where pavilions go (high up or at the edge); afterwards either
  "a pavilion stands there" or simply "the path is open". Checked: an end near the east edge and an
  end on a peak shoulder both got a pavilion.

## Midterm round, part 6: Huangshan pines, techniques audit

Owner feedback, with photos of Huangshan pines and their needles: even the most detailed pine was
a cluster of blobs. Huangshan pines have a bent trunk and flat top, long level limbs in layers
(often one arm reaching far out), and short stiff needles in upward tufts like brush heads.

- **L-system.** Eight generations (was seven). The trunk climbs, setting one or two limbs at the
  golden angle; in the last three generations it stops and spreads into a crown of level limbs (the
  flat top). Limb -> sprays to either side; spray -> a fan of twigs; twig -> one or three tufts.
  Needle tufts also sit at the end of every shoot of depth 2 or more.
- **Turtle.** Limbs are re-levelled every step (their left vector kept horizontal), so `+` and `-`
  fan the sprays out flat in layers. The trunk wanders (bend 0.26) but keeps climbing; limbs sag
  (0.05 per step); twigs turn up (0.14). Limbs on the tree's +x side grow up to 1.7x longer, and
  `placePines` faces that side outward on the edge (the Welcoming Pine's long arm). The trunk base
  flares (1.6x). Normals are written by hand: smooth bark, ellipsoid clouds, needles lit as part of
  their tuft. The pine material is double-sided.
- **Needles.** Each tuft is 22 thin triangles opening up to 0.8 rad around an axis halfway between
  the shoot and the sky, dark at the base and light at the tip, over a flat dark core under each
  spray so the layer still reads as one mass.
- **LOD, cut at the sprays (depth 2).** LOD0: every twig and needle (about 10k-19k triangles per
  variant). LOD1: 7 wider needles per tuft, one stick per spray (3k-5k). LOD2: one flat cloud per
  spray (1.5k-2k). Switch distances 0 / 40 / 100 (were 0 / 28 / 75): at the opening view the
  trees were all on the old LOD2, one blob per limb, which was the "cluster" the owner saw.
- **Techniques audit.** The grass card still said its wind was a noise pattern; it now reads the
  wind field (title "Grass", no longer overlapping the wind card). The wind card moved before
  grass, since the intro promises the order the code runs. The intro now says everything but the
  drawn paths comes from the seed. The colour card's what/where no longer repeat each other and
  point to Peaks for the peaks' own colours. "Colour" spelled "Color" throughout the English.

- **Follow-up: no cores, bottle-brush needles.** The owner saw the dark cores under the sprays as
  discs with needles stuck in them (a cactus). Removed every cloud and core. Needles now grow along
  every shoot of depth 2 or more (90 per unit of shoot at LOD0), standing out 0.6-0.95 rad from the
  shoot, leaning up, 0.36 long; each tip closes into a brush of 14. A new rule level, E (a short
  shoot), gives the sprays enough needles to read as a mass on their own. Needle green deepened to
  #3a6340. LOD: 0 = every twig and needle (20k-37k triangles per variant); 1 = 14 per unit and 4
  per tip, 2.6x wider, one stick per spray (4k-7k); 2 = three 7x-wide needles per tip (2k-3k).
  Checked side by side: LOD0 and LOD1 match at 45 units, LOD2 keeps the layered outline at 90.
  Switch distances moved to 0 / 60 / 180, so the opening view shows LOD1 and close-ups LOD0.

## Midterm round, part 7: panel legibility, performance

- **Panel.** The rule that made leva button text paper-coloured also hit the theme swatches, so
  their names vanished; swatches are now excluded and drawn in the paper palette (seal-red frame on
  the chosen one). Checkboxes were a 16 px box in the input colour with no border, and leva draws
  the tick in ink on ink when checked: they now have an ink outline and a paper tick. The curve
  and sun-arc controls still used the old dark UI colours; now SILK_UI.
- **LOD check (in the page).** At the opening view (106 units out) all 12 trees are on LOD1; next
  to a tree all are on LOD0 (every tree is within 60 units); 60 units from one tree it drops to
  LOD1. LOD2 only shows when zoomed far out.
- **Measured (this machine, canvas 1536 x 802).** GPU+CPU per frame with readPixels sync: 2.6 ms
  at resolution 128, 2.9 ms at 256; terrain about 1.3-1.5 ms of it, cloud sea about 0.6-1.2 ms,
  useFrame logic under 0.01 ms. Pixel ratio 1 / 1.2 / 1.5 / 2: 2.5 / 2.9 / 3.5 / 4.9 ms.
  Terrain triangles 295k at 128, 1.18M at 256. Rebuild on a shape change: createIsland 0.3 s at
  128, 0.97 s at 256, plus grassSites 0.15 s. A click: one raycast 6 ms at 128, 25 ms at 256;
  route + masks + re-filtering grass and flowers about 60 ms.
- **So the lag is rebuilding, not drawing.** Dragging a shape slider rebuilt the whole island on
  every step (about 1.2 s each at 256). Shape values now settle for 250 ms before the island is
  rebuilt (`useSettled` in controls.ts). The pixel ratio is capped at 1.5 (44% fewer pixels than 2x
  on a retina screen). The resolution hint now gives the measured triangle counts and times.

## After the midterm, part 1: a scale system

Feedback at the midterm (Oct 14): scale. The island was a 62 m hilltop with a 7 m main peak, while
pines and pavilions were life-size, so a pine stood almost as tall as the peak. Props were also
sized on a radius-31 island and scaled with the radius, so a bigger island only made them bigger.

- **`core/scale.ts`**: 1 unit = 1 m; `SCALE_TARGET` holds the target size of every kind of thing
  with its source (Welcoming Pine 10.02 m; island rows provisional), plus `niceStep` and
  `withinTarget`. Explained in `docs/scale.md`.
- **Scale view** (button in the tool bar): a ground grid and contour lines in the terrain shader
  (`uSurvey`, steps from `surveySteps`: about 12 cells across, 8 contours up the main peak, drawn
  with `fwidth` so they stay a pixel wide); a wireframe box with a height label on every peak,
  pine and pavilion, measured from the meshes (`userData.scaleId`) every 0.5 s; two 1.7 m cinnabar
  figures; a legend with now / target / share of the main peak, out-of-range sizes in cinnabar,
  and a scale bar true at the island centre's depth.
- **Measured, Penglai preset**: island 69 m across, main peak 7 m, spires 3.1–4.4 m, cliff and
  hanging rock 41 m, pools 4.7–7.5 m across, pines 3.9–6.6 m (94% of the main peak; target 7%),
  path 1.2 m, grass 0.17–0.4 m, Zhuyu 0.21–0.5 m.
- Nothing is resized yet. Moving the terrain to the target scale is the next step, once the owner
  picks the island size.

## After the midterm, part 2: real scale (step 1)

Owner chose the ~1 km island (2026-10-21) and asked that every size be checked against real data
first; sources are in docs/scale.md.

- **`core/scale.ts` `SIZES`**: all props in metres, no more `radius / 31`. Pines by site (cliff
  edge 4–8 m, plateau 8–15 m, sheltered 15–20 m with 30% chance on gentle off-peak spots), gap
  15 m, LOD at 80 / 300 m. Pavilion columns 2.6–3.2 m, ring 1.6–2.4 m, roof 1.4–2.2 m; 40 m apart,
  at most six, site search 8 m. Path 1.5 m, arches up to 20 m over gullies 4 m deep, mask cells
  1 m, laying capped at 8 s. Pools 5–12 m radius. Falls 3 m at the lip, launched 0.5 m out.
  Walking 1.3 m/s, eye 1.6 m. Camera clearance 2 m.
- **Preset**: radius 500, peak 120, underside 260 (300 gave 409 m of cliff and rock, over the
  400 m target). Plateau relief 0.03 of the radius.
- **Grass**: a 40 m disc around where the view meets the ground (or under the walker), on a fixed
  2 m world grid seeded per cell; 60 candidates/m² inside 12 m, 15% of that at the edge; a cell
  makes only the sites it keeps. 50 ms per regrow, 45k blades at the default density; regrows
  after the focus moves 10 m, nothing when the camera is over 250 m away. Flower clumps 12 m.
- **Camera and sky**: far 20 km, near = 0.1 × height above ground (0.1–50 m), zoom to cursor, min
  distance 3 m; sky sphere 16 km; cloud plane 32 km with its pattern and horizon fade scaled by
  radius / 31.
- **Measured** (scale view): island 1116 m, main peak 120 m, spires 52–75 m, cliff and rock
  369 m, pools 11–18 m, pines 6.3–16.5 m (14% of the peak; was 94%), grass 0.09–0.2 m. Every row
  inside its target.

## After the midterm, part 3: water system, lake, forest

Owner, after the real-scale step: the world looked bare and the pools "ridiculously small", and
asked for a lake and a more representative water system (there may not be time for five islands).
Looked up first: Huangshan is 98.29% forest; natural Huangshan pine stands carry 750–1514
trees/ha at 3.7–10.2 m mean height; the Emerald Pool is about 15 x 8 m (so our pools were
realistic, only isolated); Flying-Over Rock is 12 m.

- **Lake** (`pools.ts`): the first pool is a lake, radius 60–100 m tried widest first, allowed to
  reach the foot of a peak (lift up to 0.15 of peakHeight). Its bed is cut only below its water
  (`poolBasin` with the ground height: cut down to level − 8 m, shallowing to the shore, easing
  off over the outer fifth), so no carved wall shows above water; the outline wavers by three
  sines. The shore mesh uses one ray per 4 m of shore (up to 256).
- **Water system** (`generators/water.ts`, 90–110 ms): heights on a 256 x 256 grid; priority
  flood from the island's edge with a 1 mm slope over filled flats; D8 steepest descent; cells
  from high to low add their area downstream. Streams start at 6000 m² upstream, width
  0.6 m x sqrt(area / 6000 m²) up to 6 m, traced from each source to a junction or the rim,
  broken where water stands in the lake and pools, smoothed by two rounds of corner cutting.
  Exits are sorted by area; the falls (`createWaterfalls`, new `exits` argument) take the
  largest that are apart, as wide as their stream (at least 3 m).
- **Land cover** (`generators/cover.ts`, 0.3 s): 512 x 512 RGBA map. G forest = no cliffs (slope
  0.35–0.7), thinning up the peaks (0.2–0.55 of peak height), open at the rim (0.86–0.96),
  times max(clearing noise at 140 m with threshold 0.32, 0.85 x wetness); none in water. B
  wetness from log upstream area (2000–40,000 m²). R stream coverage, rasterised from the stream
  lines with their widths. Result: 54% forest, 37% open, 8,200 m² of running water.
- **Plants and stones** (`generators/forest.ts`): forest pines on a 3 m world grid kept by
  density (48,769, about 1100/ha of forest, 4.3–10 m, taller where wet, shorter up the peaks);
  rhododendron thickets on a 5 m grid at forest edges and rocky ledges (5,546, 1–3 m); boulders
  on a 22 m grid on rocky ground, size cubed toward 2 m (119, 2–12 m).
- **Rendering** (`Vegetation.tsx`): instanced pines in three levels re-sorted every 0.3 s or
  4 m of camera travel: grown L-system pine (lightest level) within 40 m, a 44-triangle
  three-tier stand-in to 220 m, a 24-triangle two-tier crown beyond; crown 0.6 of the height
  across. The pine shader now supports instancing. Shrubs and boulders are static instanced
  meshes (prop material). Terrain shader: forest floor (smoothstep 0.1–0.45 of density, so a
  half-dense stand does not mix olive with the autumn meadow), greener wet ground, streams as
  sky-reflecting water with a drifting ripple. 56–57 fps far and close in the browser pane.
- Grass keeps out of the forest (density x (1 − 0.9 forest)) and running water; lone pines avoid
  water. New technique cards: Water, Forest; pools and falls cards updated.
- **Follow-up: forest kept to 10–20%.** The owner found the 54% forest claustrophobic, uniform
  and slow, with no room to build. Clearing threshold 0.32 → 0.72 and wet-ground forest 0.85 →
  0.25: mean forest 15.7% of the top, 78% open, 14,007 trees. The Wonderland direction moves to
  its own Atlas island (docs/wonderland.md); Penglai stays as the realistic-scale study.

## Forest by where trees grow (owner: trees down the cliff; "Dalmatian" patches)

- Trees had grown down the plateau's roll-over: forest only opened at 86–96% of the rim radius,
  while the plateau rolls over at 78% (25% of the forest lay past that line). Now it ends by the
  meadow line (70–76%, before the roll-over): none past it.
- One noise at one scale (140 m) cut at one threshold made evenly sized round patches. Now a
  suitability: wet ground along the streams (0.9), the peaks' feet (0.55), and patches of a
  noise of three scales (150 / 60 / 22 m), warped 30 m (0.75); forest where it passes 0.5, the
  edges thinning over ±0.14, so a few trees stand out beyond. Bare peaks and steep rock as before.
- Coverage kept near the owner's 10–20%: 14.2% of the top (it was 15.8%, a quarter of it on the
  cliff), tuned by the threshold (0.78: 4%, 0.6: 7.9%, 0.5: 14.2%, 0.46: 17.9%).
