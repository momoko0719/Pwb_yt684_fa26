# Fold colour finish + low shrub patches (2026-10-27)

Owner's scope: two visible changes only, to ease the emptiness of the overview and middle views:
finish the rock-fold colour, and add patches of low grey-green shrubs. No fish, veins, buildings,
weather or complex ecology. Stop once living patches with volume stand between the white stones.

## 1. Fold colour (no change to the fold field)

- Default strength 0.75; `PORCELAIN.foldStone` deeper, less blue, a little grey-green (start near
  #829087, judge on screen).
- The tint kept the lightness (×0.94 of the white): a deep colour came out pale. Instead the fold
  rock's lightness becomes a constant share of the white (`FOLD_LIGHT`, start 0.72): visibly deeper,
  not black, lighting unchanged.
- Files: `palette.ts`, `cdlod.ts` (the mix), `rockFolds.ts` (default).

## 2. Shrubs

One generator, one kind: `shrubs.ts` (pure).
- **Form** (`shrubGeometry`): 0.4–1.2 m high, wider than high; 4–6 leaf lumps of different sizes
  (low-poly, noise-dented), off-centre; 2–3 short stems at the base. Grey-green, darker below, a
  few shades per plant by instance colour. One geometry for every distance (~150 triangles): no
  pop between levels.
- **Patches first**: candidate centres on a jittered 18 m world grid (each cell its own seeded
  chance). Suitability, the best of: the range's foot (fold field's mountain weight 0.03–0.5, gentle),
  woodland edge (woodland within ~10 m, not its heart), a damp hollow (moisture high, off the water).
  Excluded: water and 3 m round it, steep (slope > 0.6), terrace, cliff, ridge, outside, and the
  creature's dwelling square (its routes are not given shrubs as obstacles this round). Radius 6–15 m,
  a few satellites of 3–6 m.
- **Plants in a patch**: 1.4 m jittered grid; kept by (1 − (d/r)²) × a gap noise: dense at the
  heart, thinning to the edge, with holes; larger plants toward the heart.
- **Ground**: a soft patch field (discs with a noisy edge, blurred) on the zone grid → `uShrubGround`
  in `cdlod.ts`: a restrained moss/soil tint under the patch as a whole (not a disc per plant), world
  fixed, under cover and jade.
- **Drawing**: `ShrubPatches.tsx`: instanced, one mesh per 64 m tile (frustum culled), prop-style
  light. Panel: View → shrubs on/off.

## 3. Acceptance

Seed 684 at fixed cameras (before/after): overview shows a few organised vegetation masses; the
woodland edge at middle distance has a transition pine → shrub → ground; a close view where a
shrub sits on the ground at the right scale; a zoom sweep without pop or colour jump. Seeds 7 and 42:
distribution valid (`check-world` prints patch and plant counts). Frame time at the same camera
before/after (the stats panel's numbers checked against EXT_disjoint_timer_query).

## 4. Water flags (recorded, not reworked)

`check-water` now also counts, among "mesh edges standing above the ground", how many the water
shader's shore clip (`groundShore` in `flowWater.ts`) cuts away. 2026-10-27, default build: of 27–89
such edges per case, 3–16 are cut away; the rest stand up to 15–42 cm above the shader's shore, so
they can show as small cut edges of water on the bank. A real difference in the build, not only a
check artefact; it came with the 10-26/27 shore change (`STREAM.bank` 0.5 → 0.22, `UNDER_BANK` 3 → 8).
Fish wait until the water's edges are settled.

## Results (2026-10-27)

**Fold colour**: `PORCELAIN.foldStone` #829087 (deeper, greyer, a little green; apart from the lake's
cyan-blue); the fold rock's lightness a fixed **0.72** of the white (`FOLD_LIGHT` in `cdlod.ts`; was
0.94, which kept a deep colour pale); default strength **0.75**. Fold field unchanged.

**Shrubs** (`shrubs.ts`, `ShrubPatches.tsx`):
- Form: 4–5 leaf lumps (icosahedron, detail 1, dented at two scales; normals half round, half facet),
  off-centre and low, 3 short stems; unit shape scaled to 0.6–1.2 m high, 1.3–1.8 × as wide; 3
  variants; colour between `shrub` #7F8F80 and `shrubShade` #55635A per plant. ~424 triangles each,
  one shape at every distance (no level switching, so no pop).
- Patches: 18 m candidate grid; suitability max(range foot, 0.9 woodland edge, 0.75 damp hollow) ×
  a 70 m gathering noise; patch radius 6–15 m and 0–2 satellites of 3–6 m; plants on a 1.4 m grid kept
  by 0.9 (1 − (d/r)²) × a 5 m gap noise; none within 3 m of water, on slope > 0.6, terrace, cliff, ridge,
  within 1.1 m of a trunk, or in the creature's dwelling square.
- Counts: seed 684: 36 patches, 1,096 plants; 7: 44 / 1,416; 42: 36 / 1,083. By zone (684): open 467,
  woodland 353, wet shore 221, habitat 54, rock slope 1 (the range's foot mostly lies in "open").
  Generation 13–19 ms (main thread).
- Ground: patch discs, edge frayed by noise, blurred 4 m, on the zone grid → `uShrubGround`; an albedo
  change toward `shrubGround` #B4B8A3 (0.6 at full weight), lighting kept, under jade.
- Panel: View → 低灌丛 / Shrubs (on). Stats: 灌丛（片 · 株）.

**Seen (seed 684, same cameras)**: overview: grey-green masses round the groves and a few on open
ground; pines no longer stand straight on white; most white stone still open
(`shots/shrubs-overview-on.jpg` vs `-off.jpg`; the "off" shot also has the fold colour off). Middle,
woodland edge: pine → shrub patch → grass → white stone (`shrubs-middle-on/off.jpg`). Close: shrubs
sit on the ground at the right scale; faceted low-poly leaf masses; the lone foreground one can
still read as a mossy stone (no light-top/dark-under gradient, outline not broken enough)
(`shrubs-close.jpg`).

**Cost** (canvas 635 × 784, EXT_disjoint_timer_query median of 30; the stats panel's "GPU per frame"
was not compared): overview 8.8 ms on / 9.7 off, middle 7.8 / 9.6, close 9.8 / 8.8: differences within
noise, so the GPU cost is not resolved by this measurement. Triangles: overview 1.26 M on / 0.89 M off;
middle 1.20 / 0.99 M; close 1.23 / 1.04 M (budget 1.5 M). Draw calls +132 at the overview (172 tile meshes).

**Checks**: `tsc` clean; `npm run build` ok; `check-shrubs` (684, 7, 42): all hold, reproducible;
`check-world` (684, 7, 42): all hold (creature unaffected: shrubs stay off its square);
`check-rock-folds 684`: holds.

**Not verified**: seeds 7 and 42 by eye (counts and placement only); a continuous zoom sweep for
shrubs (no LOD by construction, not watched); GPU cost (within noise).

**Next**: if the shrubs should read more as foliage close up, give the leaf lumps a light top and
dark underside (a vertex colour in a shrub material) and a more broken outline; if triangles get
tight, a lighter shape beyond ~120 m. Water: the bank edges (section 4) before fish.
