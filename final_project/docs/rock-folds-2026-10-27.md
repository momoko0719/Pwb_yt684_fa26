# Rock folds, phase 1 (2026-10-27)

Goal of the round: in the normal view the mountains stay warm white; the big recessed folds take a
restrained cyan-grey, the ridges stay white. Read from afar as structure, at middle distance as
colour following form. No veins, ochre bands, new plants, ground or water this round.

Reference idea only (not simulated): jade-bearing country rock is rich and varied, jade appears
locally (Hetian/Yutian, Burmese jadeite, pounamu). Here: white stone with structure and local
colour difference. The field below is an artistic form proxy, not a deposit or hydrology model.

## Must-read files

| File | Role |
|---|---|
| `src/experiments/wonderland-terrain/ground.ts` | `groundRules`: `meadow(x, z, edge)` (the plain under everything) and `natural` = meadow + range (limited by the apron near the terrace); `bakeGround` writes the 1 m height grid (channel 0 height, 1–2 gradient, 3 outline distance) |
| `src/experiments/wonderland-terrain/range.ts` | `rangePeaks`, `rangeHeight`: the ring of peaks (rows, spurs, gullies), from the frame and seed |
| `src/experiments/wonderland-terrain/terrain.worker.ts` | builds ground → terrace → water (digs the grid) → zones; posts buffers to the page |
| `src/experiments/wonderland-terrain/Scene.tsx` | receives the worker's island; `Ground` makes textures and binds them to the terrain material |
| `src/core/terrain/cdlod.ts` | ground shader: porcelain light → weathering → zone surfaces (wet, litter, terrace, rock face) → cover tint → jade |
| `src/core/palette.ts` | colours (`PORCELAIN`) |

Terrace plates, pool water, streams and the underside are their own meshes and materials (not the
`cdlod` ground): they cannot be tinted by the ground shader.

## Inputs reused

- **Mountain lift** = final grid height − `rules.meadow(x, z, edge)`: how far the range raises the
  ground above the plain. Continuous, zero on the plain and by the terrace (the apron), follows
  seed and Layout (peaks come from the frame). Negative in dug stream beds (clamped to 0).
- **Final heights** (grid channel 0, after the water has dug it): the fold measure is computed from
  these, not from the displayed CDLOD mesh, so LOD cannot change it.

## New data

`rockFolds.ts` (pure, run in the worker after the water): on the grid's own texels (1 m):
- `mountain` = smoothstep of lift (fades to the foot, no ring edge);
- concavity at two scales: `blur_r(h) − h` (a separable box blur, three passes ≈ gaussian, no ring
  sampling): positive in hollows, negative on ridges; a uniform slope gives 0 (steep ≠ concave);
- `fold` = continuous weight from both scales.
Packed RGBA8 (R mountain, G fold, B fine scale, A broad scale), same square as the light map, so the
shader reads it with the light map's `uv` (LinearFilter on 1 m texels of blurred data: no squares).

Shader (`cdlod.ts`), right after the base stone colour and weathering, before zone surfaces, cover
and jade: `w = mountain × fold × strength`; `color = mix(color, color × foldStone / body, w)` (an
albedo change: lighting stays). Debug view: `mountain × fold` in grey.

Palette: `PORCELAIN.foldStone` (low-saturation grey-cyan). Panel (Advanced): on/off, strength,
fold debug (off by default).

## Order and acceptance

1. Field + stats on seeds 684, 7, 42 (lift and concavity percentiles on mountain texels) → pick
   scales and thresholds from the numbers.
2. Worker + texture + shader + debug view; check grey debug: hollows bright, ridges dark.
3. Colour pass; tune strength at overview / middle / close, seed 684, then 7 and 42.
4. Checks: `tsc`, `check-world` (heights, water, trees, creature unchanged: compare hashes before
   and after), screenshots on/off at fixed cameras; GPU if measurable.

Accept: island still reads white; folds read at middle distance; no camo, mould or squares; close
up still rough stone; no jump when zooming through LOD; same rule on 7 and 42; nothing but colour
changed.

## Results (2026-10-27)

**Field** (`rockFolds.ts`, worker, 51–68 ms on seeds 684 / 7 / 42):
- mountain = smoothstep of lift over **6–30 m** (first 2–20 m: the foot, concave where the range meets
  the plain, took colour in a ring), blurred over 6 m;
- concavity `blur_r(h) − h` at **6 m** and **18 m** (box blur ×3). Measured on mountain texels
  (lift > 30 m), seed 684: 6 m p75 −0.2, p90 1.2, p97 3.7 m; 18 m p75 −5.4, p90 0.1, p97 4.3 m
  (round-headed peaks: most of a peak is convex). Seeds 7, 42 within ±0.6 m of these;
- fold = 1 − (1 − broad)(1 − 0.5 · fine), broad eased **0.3–2.5 m** (first 0.6–4.5: folds mostly under
  half weight, the colour did not show), fine **0.1–0.8 m** (first 0.15–1.2); then blurred over **3 m**
  (on steep faces a 1 m texel spans metres of height: jagged tongues ran down them before);
- of the mountain (≈20% of the island), 26–28% has fold weight over 0.3; plain cells tinted: 0.

**Colour** (`cdlod.ts`): `color = mix(color, color · k · 0.94 / luma(k), mix · mountain · fold · (0.9 + 0.2 noise))`,
`k = foldStone / body`: a change of hue at nearly the same lightness (first a plain albedo ratio: it only
darkened, R −4 at most). `PORCELAIN.foldStone` **#A9C3C4** (first #B7C7C6). Default strength
**0.55** (first 0.25, then 0.4). Noise ±10% of the weight, 20 m period, world-fixed.

**Measured on screen** (seed 684, the terrace looking east at the range's inner wall, 1280 × 895):
on vs off, R −1 to −9, B +1 to +4, 10 of 30 samples by 6 or more. Zoom sweep at three fold points
from 70 to 340 m: colour within 1–2 levels, the on − off difference constant (−6/+2, −7/+3): no LOD jump.

**Checks**: `tsc` clean; `npm run build` ok; `check-rock-folds` (684, 7, 42): reproducible, no plain tint;
`check-world` (684, 7, 42): all rules hold, trees and creature as before (the field only reads the grid);
`check-dwelling 684`: clean; `check-water`: 17 flags (see the hand-off: mostly "mesh edges above the
ground" from the 10-26/27 shore change, not from this round).

**Not verified by eye**: seeds 7 and 42 in the page (the panel's seed input did not rebuild from a script);
GPU time (not measured; one texture fetch and a few ALU ops per ground fragment, when on).

**Next**: the base folds read at middle distance only faintly (restrained by design); worth an
owner look before "a few stone bands". If the folds should read from the overview, raise strength or
foldStone saturation first; do not add bands on top of a base that does not yet read.
