# Wonderland — whole-island world plan

Status: agreed with the owner 2026-10-25. Kept current while the work runs; the hand-off for a
new session is `wonderland-handoff.md`. Design and art direction: `wonderland.md`. Course:
`course.md` (final review Dec 2, deliverables Dec 18).

## 1. Goal

The final show opens on **one whole island that holds together**, then zooms into a peak, a pool
or a creature's ground, and back: overview → chosen area → close view → overview. From far to
near the same rules should be visible organising ground, water, plants and creatures, and life
should slowly leave traces on the island.

The local "栖居成玉" experiment (one creature, real contact, jade) stays, as one demonstration
area inside the whole-island system.

## 2. Art principles (kept)

- A ring of peaks around a raised terrace; the terrace's stair of pools upstream, the falls, the
  water dividing downstream. Warm white stone; jade only where life has touched it.
- Vegetation in groves and lone pines, with density, clustering and transitions; bare white stone
  and empty ground kept (留白). No even carpet of grass. Not Penglai's colours or density.
- Real scale: 1 unit = 1 m (`scale.md`, `core/scale.ts`). Check peak : pine : creature : person.
- Everything placed by rule. Fixed seeds are for demos and comparison only.

## 3. Decisions (owner, 2026-10-25)

1. **Layout rules first, limited.** Keep the art structure (ring, stair of pools, falls, fan of
   streams). Basin position, opening direction, peak arrangement and terrace proportions come
   from constraints and the seed. The number of terrace levels does not change this round.
   Stable ground and water are not changed just to make seeds differ. Fixed design parameters may
   stay, including ones for direction, relative position and layout relations; what goes is a
   coordinate without a spatial reason.
2. **The hall is removed** and deferred (it may return with a cultural role and a use). Other
   placeholders are replaced by rule or explicitly deferred; no buildings to fill space.
3. **Wading later.** Creatures may wade in future, but not this round. Next round: find the dry
   ground's connected regions over the whole island and pair homes with drinking places within
   each, not only from the plunge pool. Fords must come from the real bed, depth, slope and the
   body's ability, never from relabelling the navigation grid.
4. **Two milestones.** Round 1: layout and whole-island environment. Round 2: creatures over the
   whole island. Do not refactor everything at once.
5. Similar zone shares across seeds are not a failure. Multi-seed checks look at spatial
   relations, rule validity, reachability and reproducibility.
6. The contact texture scheme is compared first (section 8); round 1 is not blocked on it.

## 4. What exists

Round 1 (2026-10-25) is done: see section 7 for what changed; the table below is the state before
it, kept for the record of what was hand-set.

**Before round 1** (`src/experiments/wonderland-terrain/`):

| System | Files | Rule or hand-set |
|---|---|---|
| Island outline, meadow | `ground.ts` | Rule (oval of fixed design axes, noise edge); meadow swells hand-set (`layout.ts` MEADOW_SWELLS), rise hard-coded toward +x |
| Range of peaks | `range.ts` | Rule along two rows, but its centre (80, 0) and "east" are constants |
| Terrace plates, outlets | `ground.ts`, `terrace.ts` | Outlets by rule; the three plates' centres and sizes hand-set (`TERRACE_PLATES`), the pass a constant (-70, 4), "west" a constant |
| Pools, falls, plunge pool, streams | `terrace.ts`, `water.ts`, `core/terrain/*` | Rule (potential flow, routes) |
| Underside | `core/terrain/undersideMesh.ts` | Rule |
| Ground material (porcelain, jade from contact) | `core/terrain/cdlod.ts`, `core/shaders/porcelain.ts` | Rule |
| Creature (state machine, A*, gait, contact) | `dwelling.ts`, `creature.tsx` | Rule; drinking only at the plunge pool, homes within 50 m of it |
| Corner: two pines, watching stone, views | `corner.tsx` | Rule |

**Placeholders still drawn** (`layout.ts` BLOCKS, `blocks.tsx`): groves (6 hand-set clusters),
hall, four pavilions, bridge, landing, lookout, a person for scale.
**Dead constants**: `LAKE`, `POOLS`, `STREAMS`, `CHANNEL`, `LOOKOUT` (no use outside `layout.ts`).

**Now (after round 1)**: the layout from the seed and design relations (`frame.ts`); no
placeholder drawn; zones (`zones.ts`, in the worker, debug view "Zones"); woodland and lone pines
(`woods.ts`, Penglai's instanced pine LOD); a person on the watching stone for scale.

**Tried, not in the page**: the sparse contact tiles (measured only, section 8).

**Not built**: ground cover, sites and routes for people, bridges, pavilions, the landing, the
lookout, fords, more creatures, the presentation camera flow (overview → area → close → back).

## 5. Generation order and data

```
seed + design params
  └─ frame (opening, basin, plate proportions, range centre, meadow swells)      generation
      └─ ground rules → height grid (worker)                                       generation
          └─ terrace plates, outlets, pools, falls                                 generation
              └─ water below: plunge pool, channel, streams, water field           generation
                  └─ zone field: height, slope, water distance, shelter, ridge,     generation
                     reach, dry-land regions → zones + woodland suitability
                      └─ woodland trees, lone pines                                 generation
                      └─ (round 2) creature sites per dry-land region, individuals  generation
                          └─ creature needs, states, routes, contact → jade        runtime
                      └─ (later) sites and routes for people, bridges, pavilions    generation
```

- **Generation** (per seed and parameters, cached, in the worker): everything up to trees and
  sites.
- **Runtime**: creature needs and states, routes, the contact map (jade, later trampled grass and
  worn trails), time of day, wind.
- **Art parameters** (sliders with limits): opening direction and spread, basin offset, range
  height, woodland cover and minimum grove size, jade colour and ripening, tree colours. They set
  how much and how things relate, never a coordinate.

## 6. Zones (round 1)

Inputs on a 2 m grid: height, slope, distance to water (streams, plunge pool, terrace pools),
shelter (mean height on a 24 m ring minus the point's), ridge (height minus mean on a 14 m ring),
reach (dry walkable ground, flood-filled into connected regions).

| Zone | Rule (first priority wins) |
|---|---|
| water, terrace | from the water field and the lowest plate |
| cliff (bare rock) | slope > 1.0 |
| ridge | ridge > 2.5 m and height > 30 m |
| rock slope | slope 0.45–1.0 |
| wet shore | water within 10 m, slope < 0.3 |
| woodland | suitability (moisture, shelter, gentle ground, a broad noise for clumps) above a threshold; groves under a minimum area dropped |
| habitat | dry, walkable, slope < 0.1, sheltered, 8–70 m from water |
| open stone | the rest (the white ground left empty) |

Planning probe (6 seeds, before the fixes): open stone 29–31%, cliff 23–25%, woodland 8–10%,
wet shore 8%, habitat 1.5–3%. Same seed → byte-identical map. Problems found and how they were
handled (results after round 1 in section 7):

1. Woodland too broken (104 of 118 patches under 200 m²): drop the 25 m noise term, drop groves
   under 300 m², thin toward the edge by suitability.
2. The range is nearly all "cliff": lone pines get their own rule (ledges: local slope minima in
   cliff and ridge).
3. Dry ground reachable from the plunge pool: 2.9–5.3 of 18.6 ha (streams cut the meadow). Round 1
   records the dry-land regions; round 2 pairs homes and water inside each.
4. The layout does not change with the seed (hand-set coordinates): fixed by step R1.1.

## 7. Round 1 — layout and whole-island environment

Each step: what, files, acceptance. Steps are done in order; the hand-off is updated after each.

Status: **R1.1–R1.5 done** (2026-10-25). Results under each step.

**R1.1 Layout rules (limited).** New `frame.ts` (pure): from the seed and design parameters, the
island's frame: opening direction (nominal west, seeded within ±spread), basin centre (offset
from the island centre away from the opening, a share of the radius), the three plates in the
frame's own axes (proportions of the island, small seeded variation, nesting gaps kept), range
centre (relative to the basin), range "away" direction, meadow swells (seeded, on open meadow
outside basin and range). `ground.ts`, `range.ts`, `terrace.ts` read the frame instead of
`TERRACE_PLATES`, `TERRACE`, `PASS`, `RANGE.centre`, `MEADOW_SWELLS`, the hard-coded west/east.
Accept: tsc clean; `check-world` passes on 8 seeds (plates nested with gaps; range clear of the
terrace; water continuity as before; outlet on the opening side; creature sites found); seed 684
still reads as the agreed island (overview shot compared with before).
*Done.* `frame.ts`: the back's direction (east, turned by the seed within ±17°), the basin
(70 m toward the back, moved up to ±10 m along and ±14 m across), the plates in the frame's axes
(reference sizes scaled by the island's radius on each axis, ±7%, upper plates' offsets ±10 m),
the range centre and the underside's keel relative to the basin and back. The pass: where the
range's open axis crosses the lowest plate. Meadow swells by rule (4, on open meadow clear of
terrace and range). With variation 0 the plates and range are the agreed ones exactly; the pass
moved about 8 m (now on the axis, not at the old hand-set point), so the ground differs a little.
Panel: Layout → turn (°), variation.

**R1.2 Placeholders.** Remove the hall (decision 2). Remove groves (replaced by R1.4), pavilions,
bridge, landing, lookout from the drawn blockout: deferred to the sites-and-routes phase, which
places them by use (landing: low flat rim on the opening side joined to routes; lookout: highest
reachable point scored by view; bridge: where a people's route crosses a stream at its narrowest;
pavilion: route pauses with a view). The person for scale stays, placed by rule on the watching
stone. Delete the dead constants. Accept: no hand coordinate left in the drawn scene; strings and
legend tidy.
*Done.* `layout.ts` holds design numbers only; `blocks.tsx`, BLOCKS, LEGEND and the block strings
are gone. The watching stone now also keeps 4.5 m off the way to every home (with the layout
turned, a stone came to stand on a way: 93 steps of the creature inside its clearance on seed 684).

**R1.3 Zone field.** New `zones.ts` (pure, run in the worker after the water): the field of
section 6 with the fixes, dry-land regions, woodland suitability. A View toggle "zones" colours the
ground by zone (debug, palette `ZONE_DEBUG`). Accept: same seed → same field; stats per seed in
`check-world`; bake time measured (target < 300 ms).
*Done.* 33–61 ms in Node. Woodland noise at 80 and 40 m; groves under 300 m² left open; on 8 seeds
13–18 groves of 300–4,000 m² (they were 100–140, most under 200 m²); dry-land regions 6–10.

**R1.4 Woodland.** New `woods.ts` (pure): trees in woodland zones on a jittered grid, kept by
suitability (dense core, thinning edge), heights by moisture and shelter, clear of water, terrace,
the creature's home, stands and corner; lone pines on ledges, sparse. Drawn with Penglai's
instanced pine LOD (`island-v1/Vegetation.tsx`, generalised into a shared component if needed) in
the porcelain colours (`PORCELAIN.pine*`). Trees inside the dwelling's region become its
obstacles. Accept: groves read from the overview, open stone stays; corner and creature checks
still pass; frame time measured at four camera distances.
*Done.* 439–522 grove trees (about 330 per ha of woodland) and 10–22 lone pines per seed; trees
keep 4 m from water, 6 m from homes, 3 m from the way home-to-water, 5 m from stands; trees on
the creature's ground are its obstacles (1.4 m). Grown pines out to 90 m (Penglai's 40 m made
the stand-ins' tiers read as flat discs against the light at the home's view).

**R1.5 Checks and views.** `scripts/check-world.ts` (kept in the project): for each seed, the
frame constraints, water continuity summary, zone shares and grove sizes, dry-land regions,
creature sites, a short dwelling run (no position in water or trees, no foot slip), and a hash of
the outputs to prove reproducibility. Camera presets for the scale check: overview (~700 m),
area (~150 m), middle (~30 m), close (~3 m). Accept: check passes; shots at the four distances;
GPU times recorded in the hand-off.
*Done.* `scripts/check-world.ts` (8 seeds: all rules hold), `check-water.ts`,
`check-dwelling.ts` kept as project checks. Shots: `shots/round1-views-684.png` (overview 626 m,
zones, area 177 m, middle 17 m, close 3 m), `shots/round1-world-8-seeds.png` (zone maps with trees
and creature sites). The camera presets are the existing ones plus the default overview; a proper
overview → area → close → back flow is left for later (section 5 of the hand-off).

**Out of round 1**: ground cover and grass, fords, more creatures, contact tiles, people's routes,
bridges, pavilions, the hall, jewel trees, solar-term weather, growth.

## 8. Contact map: options compared

Measured (seeds 684, 42, 2026; 30 cycles, one creature, current code): map 80–88 m square at
0.25 m (320²–352² cells); touched 126–204 m² (1.6–2.6% of the map); 3 of 9 tiles of 32 m touched;
the texture re-uploaded whole, up to 10 times a second while running (352² × 4 B = 496 KB each).

| | A. Grow the one map (whole island, 0.25 m) | B. Sparse tiles in an atlas | C. One map per creature |
|---|---|---|---|
| Cells | 2400 × 1920 (est.) | 32 m tiles of 128², allocated on first touch | its home range (80–120 m) each |
| CPU | 3 × Float32 + Uint8 = 60 MB (est.) | 13 B a cell: 213 KB a tile (est.) | 1.6–3 MB each (est.) |
| GPU | RGBA8 18 MB (est.) | 2048² atlas = 256 tiles, 16 MB, plus an index texture (19 × 15) | 0.4–0.9 MB each, a texture array |
| Upload | whole texture or sub-rect of the dirty box | only dirty tiles (64 KB each) | whole map per creature (as now) |
| Shader | as now | one index fetch, then the atlas; a 1-cell gutter copied around each tile for bilinear filtering | a loop over up to N maps |
| Overflow | none | atlas full: evict the faintest tile or fall back to a coarse 1 m layer | N fixed (e.g. 4) |
| Cost to build | small | largest (allocation, gutters, index, eviction) | small to medium |

Recommendation: round 1 keeps the current map (it works for the demo creature). Round 2 decides
between C (few creatures, simplest) and B (many creatures, wide ranges), from the measured home
ranges. Either way add a coarse whole-island 1 m layer (600 × 480 RGBA8, 1.2 MB est.) for trails
read from afar and as path memory (stigmergy: worn ground cheaper to walk, Class 08).

## 9. Round 2 — creatures over the island (outline)

Dry-land regions → in each, drinking places on any shore (the existing stand solver) and homes in
habitat zones, paired by walking distance; a few individuals with seeded preferences (shelter,
distance to water, openness, shyness of people's routes); needs (thirst → rest and safety →
foraging and exploring) choosing among affordances by utility; routes on a 2 m navigation grid,
cached; the contact scheme from section 8; then fords from the real bed (depth < body's wading
depth, gentle banks, slow water).

## 10. Performance and verification

Budgets (`wonderland.md`): 60 fps on a laptop, under 1.5 M triangles, rebuild under about 1 s
(worker). Baseline (2026-10-25, 1599 × 834 canvas, dpr 1.25, the home's middle view): GPU
8.3–9.6 ms a frame. Risks: zone bake time, tree count (est. 700–1,500 trees, far below Penglai's
14,000), sorting trees into LOD each 0.3 s, obstacles in the creature's walkability check (keep
only trees inside its region).

Verification: `check-world` on 8 seeds; shots at four camera distances with the debug off; GPU time
by EXT_disjoint_timer_query at the same cameras before and after.
