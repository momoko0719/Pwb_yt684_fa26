# Wonderland — design

Status: agreed direction and art direction, 2026-10-21. Updated the same day with the owner's
decisions (pass faces west; a raised terrace, option A; growth computed year by year) and the move
from a heightmap to a signed distance field (SDF) after the lab.

**Where it lives**: a new island in the Atlas, **Wonderland** (`src/experiments/wonderland/`). It
does not replace Penglai Island v1, which stays as the realistic-scale study (forest kept to
10–20% of its top). Wonderland reuses Penglai's generators (terrain, scale system, water
algorithm, LOD, wind, solar terms, pavilion grammar) and adds its own.

## The plan (blockout)

The whole island, agreed as placeholders at real size before any part is built:
`src/experiments/wonderland-blockout/` (numbers in `layout.ts`). Each part is then built on its
own, one at a time, and checked against this.

- **Island**: about 560 x 440 m; the underside hangs to about −130 m.
- **Meadow**: most of the island, open and gently rolling (0–8 m): groves of jewel trees, the
  white creatures' home.
- **Raised terrace (仙台)**: east of centre, three levels (14, 20, 26 m); the hall and a pavilion
  on top.
- **Lake**: on the top level, where the spring rises. Its water falls down the terrace's levels,
  out through the **pass** on the west edge, and down the **stair of pools** (about 10 pools, 220
  m) to the western rim, where it **falls** into the clouds.
- **Range of peaks**: rounded peaks running together around the terrace on three sides, highest
  in the east (about 90 m), lower along both arms (about 25 m), open to the west. Not spikes or
  pillars. The lookout is on a northern peak.
- **White creatures**: start at their home on the northern meadow, then roam.
- **Pavilions** where the route pauses (by the lake, by the stair, at the landing), an arch bridge
  over the stair.

The stair of pools is one feature among these, not the whole island.

## Theme

Midterm feedback asked for a theme first. Guixu's is **Wonderland**: the place in Chinese culture
that people long for and cannot reach — a paradise, a pure land. The world's own source already
describes it. In the *Liezi* (Questions of Tang), the five mountains that float above Guixu are
this ([text](https://www.gutenberg.org/ebooks/7341)):

| The *Liezi* | Meaning | In the world |
|---|---|---|
| 其上臺觀皆金玉 | terraces and towers all of gold and jade | buildings that grow at the best sites, jade and gold |
| 其上禽獸皆純縞 | birds and beasts all pure white | white creatures (chosen later by the owner) |
| 珠玕之樹皆叢生 | trees of pearl and jade, growing in clusters | jewel trees in groves with clear edges |
| 華實皆有滋味，食之皆不老不死 | flowers and fruit that grant long life | blossom and fruit through the solar terms; a glow at night |
| 所居之人皆仙聖之種 | dwellers are immortals and sages | traces only, no people shown |
| 一日一夕飛相往來者，不可數焉 | flying back and forth day and night, countless | later: flights between islands |

From *The Peach Blossom Spring* the world borrows only a way of arriving: follow the water up to
where it comes from. It does not borrow the hidden valley: the owner chose a **raised terrace** (台)
seen from afar, like an altar, with its water stepping outward and down to the rim (option A; not
B, a valley found only once inside).

## Principle: nothing is placed, everything grows

Every element comes from rules, a seed and the elements before it. The chain:

```
landform  →  water  →  travertine terraces  →  soil and wetness  →  vegetation (grows over years)
   ↓                                                                         ↓
 peaks ring, pass                                     sites (scored)  ←  open ground
                                                         ↓
                                                   routes (desire lines)
                                                         ↓
                                         buildings (grammar, sized by their site)
                                                         ↓
                                              creatures (habitats, routes)
```

Changing the seed or a parameter regrows everything downstream. Where a step is a simulation
(terraces, vegetation, building growth) it runs for a number of simulated years, so the world can
also be watched growing: the course's "persistent, ever-changing world".

## Look: porcelain by day, mother-of-pearl by night

Art direction from the owner's references (2026-10-21). What the references share, and what the
AI-looking ones the owner rejected lacked:

- **Few colours.** White and pearl carry the whole picture; gold is an accent; at most one cool
  colour (celadon or teal). Rejected: many saturated colours, sunset orange and pink everywhere.
- **One material, read by form.** Land, trees, buildings and clouds look carved from the same
  substance (porcelain, marble, paper); shapes and soft shadows do the work. Rejected: every
  surface finely carved, detail everywhere ("overloaded", "AI texture").
- **Simplified, sculptural forms.** Stacked thin terraces like cut paper; rounded clouds; trees as
  a gold, twisting trunk under a few soft white cloud-like canopy clusters; falls as straight
  vertical white lines. Under the island, the terraces' language upside down: strata stepping in
  to one keel and a tail or two (many separate drips read as a row of teeth: owner, lab 2).
- **Open space.** Large calm areas of white ground, still water and cloud.

### Two modes, following the hour

| | Day: white porcelain (白瓷) | Night: mother-of-pearl on black lacquer (螺钿) |
|---|---|---|
| Ground | ivory white `#F4F1EA`, warm shadow `#DCD8CF`, cool shadow `#BAC4C5` | black lacquer `#121314` around; the island in pearl `#E8E2DA` |
| Layering | soft steps and terrace edges catch light | fine concentric contour lines, pearl pink `#E2C6BE` and pearl teal `#8FB9B3` iridescence |
| Plants | celadon `#A9C4B8` or white canopies, gold trunks | gold trees, a cyan glow `#A8E6DE` in blossoms |
| Water | milky jade `#93C7C0` (lab; `#C3DED8` was too pale over white stone), white where it spills | silver lines, pearl reflections |
| Accent | gold `#C9A45C`: roof edges, finials, bridge posts, trunks | gold `#B8924A`, teal ruyi clouds |
| Air | white mist, a pale disc of sun | a pearl moon, a white crane |

### Elements the owner wants

- **White creatures**: smooth, simple, rounded, sleeping or resting by the pools, a little gold on
  horns or ears (the owner will choose them).
- **Arch bridges**: a white stone arch with a railing and gold-tipped posts, over the pool stair
  (grown where a route crosses water; the path generator already builds stone arches).
- **White lotus** in the still pools.
- **Pavilions** on stepped platforms, white with gold roof edges.

### Techniques this needs

- A porcelain shading model for everything: soft sky-and-ground ambient, gentle key light,
  contact shadow in creases (ambient occlusion from the height field, or a screen-space pass,
  measured against the budget), almost no texture.
- Terrace edges with a slight lip, so each layer reads like a cut sheet.
- **Contour lines as ornament**: the scale view's contour shader, reused for the night inlay.
- **Pearl**: the Class 05 thin-film pearl shader, restrained.
- Gold: a warm, slightly metallic accent material.
- Bloom on water and glow; mist sprites in hollows; sculpted rounded clouds (later).

## The route (how a visitor finds it)

The terrace is in view from the landing on: the route is a climb toward it, not a discovery.

1. **Land at the western rim**: the fall drops into the cloud sea.
2. **Follow the water up**: a stair of travertine pools climbs east, jewel-tree groves on the
   banks; the terrace and its halls ahead and above.
3. **The pass**: the gap in the terrace's western edge where the water leaves it (facing west,
   toward the sunset and the landing).
4. **The terrace**: the highest, flattest ground, pools at its head, buildings on its dry steps.
5. **The lookout**: on a peak of the range around the terrace, the whole island and Guixu below.

## Systems

### 1. Landform: a raised terrace, a range of peaks, a pass

- **Rule**: a raised terrace (台) east of the centre; around it on three sides a continuous range
  of peaks, highest in the east, open to the west. The peaks frame the terrace; they do not
  hide it. After the owner's reference (white porcelain mountains, chosen over gentle domes in a
  lo-fi comparison): steep, round-headed peaks in two rows, the front row about two thirds as high,
  the back row set in 50 m from the rim. Relief from structure, not texture (a second lo-fi: folds
  ribbing each peak from its summit read as steamed buns): each main peak sends two or three
  lower spurs down from its summit, valleys between them, and a few broad gullies cut some lower
  flanks only. All joined by a smooth maximum, so saddles between them. Near the terrace the range
  may rise no steeper than 2.2 in 1 from a strip of meadow (an apron, not a cut). Each row is a line set in
  from the island's oval; along it peaks every 11 degrees or so, nudged by chance, heights falling
  from the east toward both arms (which stop about 110 degrees round, short of wrapping the pass). No spikes or free-standing pillars (the lab's towers read as awkward stalactites: owner,
  lab 3). The **pass is found, not placed**: the lowest point of the terrace's western edge, where
  the water leaves.
- **Technique**: an SDF (Class 04 density fields and CSG): distance masks, power curves, smooth
  union; terraces cut from a mound by height (see "Representation").
- **Scale**: island 500–600 m across, main peak 100–120 m (raised from 80–100 m for the steeper
  reference) (smaller than Penglai, so one walk can
  take it in and a 2 m rim still reads from across it); pass 20–40 m wide (judgement).

### 2. Water and travertine terraces

- **Rule**: the water runs from the spring (the lake on the top plate) down a channel across the
  plates, over the pass and into a stair of five pools close below it, then off over the meadow in
  meandering streams. The pools follow how travertine forms: each a block with a near-vertical
  wall (a dam grown where water speeds over a lip), a rim and a pool; two tight groups (three and
  two) stacked so each wall wraps the downstream side of the pool above, staggered half a level,
  spilling from a dam's lowest notches into one or two pools below. Their heights by rule: the
  height from the pass to the meadow shared out in drops of 3 to 4 m (with too little height, the
  lowest pools are left out). Agreed in two lo-fi wireframes after a long, even stair was rejected.
- **Growth**: the physics stays the guide (Hammer et al. 2007; Goldenfeld et al. 2006,
  [arXiv](https://arxiv.org/pdf/physics/0601116)): carbonate settles fastest where water spills
  over a lip, so rims rise and dam pools. A full deposition simulation on the heightmap gave a
  field of puddles, not a stair (wonderland/notes.md, step 2), so the stair is now built by rule,
  and growth will act on its parameters year by year (rims rising, pools deepening and widening).
- **Technique**: SDF and smooth subtraction (04), the pool water shader (05).
- **Scale**: Huanglong has more than 3,400 pools in a 3.6 km valley with 600 m of drop, from
  plate-sized up ([Wikipedia](https://en.wikipedia.org/wiki/Huanglong_Scenic_and_Historic_Interest_Area));
  our stair has tens of pools, 2–40 m across, rims 0.2–3 m (judgement, to check against a survey).

### 3. Vegetation that grows

- **Rule**: an ecosystem simulation (Class 07: growth and distribution). A few seed trees; each
  simulated year trees drop seeds within a dispersal radius; a seed takes where the ground suits
  its species (wetness, slope, soil on rock or terrace, light) and is not crowded; crowded or dry
  trees die. Groves with clear edges emerge on their own, which is the *Liezi*'s "growing in
  clusters" and the commentary's "no other trees among them".
- **Species**: jewel trees (pearl and jade crowns, blossom and fruit by solar term, a glow at
  night; new L-system grammar); lone pines in rock cracks (built); meadow grass and Zhuyu where
  no trees take (built).
- **Scale**: jewel trees 4–8 m (judgement; an invented tree, sized like common ornamental trees);
  pines 4–20 m (sourced). Budget: at most ~4,000 trees.

### 4. Sites and routes

- **Rule**: every point of open ground is scored for the things people seek: flat enough to
  build, a view (height, rim, toward the sea of cloud), near water, sheltered, reachable. The best
  local maxima become sites: landing, pool side, terrace, pass, summit lookout, grove clearing,
  creature home. Routes are desire lines: A* between sites over the terrain, reusing earlier
  routes (built: the path generator), crossing water by bridge or stepping stones.
- **Technique**: scoring masks (03, 05), A* and paths (06).

### 5. Buildings that grow

- **Rule**: buildings appear where sites score highest and routes meet. Their form comes from a
  shape grammar (built: the pavilion) extended to platforms (台), two-storey halls (阁), stairs,
  bridges and railings. The grammar's numbers come from the site: the flat area sets the
  footprint, the view sets the facing, the route sets where the stairs land, the slope sets how
  many platform steps lift it level. Over simulated time a site accretes: a marker stone first,
  then a pavilion, then a platform and hall where traffic is heaviest.
- **Materials**: jade platforms, pearl-white walls, gold roofs and finials.
- **Scale**: pavilion 4.5–6.5 m (sourced); halls and platforms to be looked up before building.

### 6. Creatures (later)

White birds and beasts (the owner will choose them). Each kind starts at a home (first: the
northern meadow) and moves from there, along routes and zone edges (sessions 9–10).

## Representation: each kind of ground its own

Decided after the stair of pools (owner, 2026-10-23): smooth ground as a height map, sharp built
things as meshes generated from their rules. The rules (outline, meadow, range, plates, pools) do
not change; only how the shape is drawn.

- **Meadow and range: a height map** with continuous level of detail (CDLOD; `core/terrain/`,
  page `wonderland-terrain`): one grid drawn per quadtree patch, patches growing with distance,
  each level's vertices sliding into the next coarser one's over the outer part of its range, so
  nothing pops; height read per vertex, light (occlusion, soft sun shadow) baked from the heights
  into a map. 1–3 ms a frame where the voxel build took 5–12 ms; ready in 0.3 s instead of 10 s.
- **Terrace, pools, water, underside: generated meshes** (next): each from its outline (a ring
  of points from the same rule), its top laid flat, its wall pulled straight down, its edge
  rounded; exact at any distance, a few thousand triangles each, so no level of detail at all.
- **Why not the SDF any more**: it was chosen because a height map cannot hold flat terraces with
  lips or the underside. It drew them, but its walls were height-map slopes compressed into a
  metre, so each pixel's search onto them landed differently (seams along the shell's cells); its
  three mesh levels held different shapes (a wall's run widened to 12 m far off) and switched
  without a blend (the shape changed while zooming); and it cost 10 s of carving and per-pixel
  marching. The island has no caves or overhangs on top, so the volume bought nothing there. The
  SDF lab stays in the atlas as a technique (`wonderland-lab`).

### The SDF build, as it was

The heightmap could not hold flat terraces with lips, overhangs, the underside, arches or caves:
each (x, z) has one height. The lab (`src/experiments/wonderland-lab/`, notes there) carves the
island from an SDF instead and meshes it with surface nets in a worker, with normals and contact
shadow (occlusion) from the field itself.

Learned so far: a riser's run must stay wider than two mesh cells or it aliases into a saw edge;
pool floors slope gently so the shore is a line the mesh can follow; noise finer than the mesh
reads as wrinkles or pockmarks.

Sharp up close: the mesh is only a shell. Each pixel steps from it onto the true surface of the
field and takes its normal, contact shadow and the sun's soft shadow there, so the steps stay sharp
at any distance. To keep it fast, everything smooth (the noise) is baked into grids on the CPU and
only the cheap step-cutting runs per pixel; no texture reads in branches without an explicit level
of detail (Direct3D flattens them); no depth written from the shader (it disables early depth
tests). Measured on integrated graphics: 9 ms a frame, 11 ms with stone filling the screen.

Its cost grows with the pixels, so it is budgeted as a system: shading by distance as the mesh is
(fine near, cheap far); one pixel ratio for terrain pages; and the resolution held to a frame
budget (about 14 ms of GPU) by stepping the pixel ratio down and up. Whole island, integrated
graphics: 8–14 ms a frame in every view tried (wonderland-blockout/notes.md).

## What we keep, change, add

| Keep | Change | Add |
|---|---|---|
| terrain generators, underside, scale system and scale view, wind field, solar terms, hour, lone pines (L-system, LOD), grass and Zhuyu, pavilion grammar, falls, water shader, cloud sea, walking | peak placement (ring and pass), meadow rule (from open ground, not a slope threshold), water (one stair from pond to rim), forest (grown groves, a few thousand trees), paths (network between sites) | site scoring, travertine deposition, vegetation growth, jewel trees, building growth (platforms, halls, bridges), jade/pearl/glow materials, bloom and mist, a plan view (map of zones, sites, routes) |

## Budgets

60 fps on a laptop; under ~1.5 M triangles drawn; a rebuild under ~1 s (long simulations run
once per seed and are cached, or run visibly as "growth"). Measured and shown in the page.

## Build order

0. Done: plan view and landform (heightmap, step 1); the SDF lab (terraces, pools, underside).
1. Done: sharpness up close (per-pixel carving) and chunks with LOD (worker pool), in the lab;
   tested at island size (2049 chunks, 3.3 s, 7–15 ms a frame on integrated graphics).
2. Done: the blockout (the plan above), agreed with the owner step by step.
3. One part at a time, each replacing its placeholder and checked before the next: the base and
   meadow; the terrace and lake; the range of peaks; the water (overflow, stair, falls); the
   underside.
4. Then what stands on it: groves, pavilions and hall, bridge; then the creatures.
5. Growth last, and small: off by default; when on, gentle ongoing change (the water shifting in
   the stair, rims rising, groves spreading), not the island regrowing.

## Decisions

- The pass faces west, toward the sunset and the landing.
- The terrace is raised (option A), seen from afar; not a hidden valley (option B).
- The spring rises on the terrace itself, a still pool at its head (option A); the water does not
  fall from the peaks (option B, rejected).
- The peaks: a continuous range of rounded peaks around the terrace, open to the west (replaces
  the compact massif; owner, after the blockout).
- The lake is the top of the water: it falls down the terrace and on down the stair of pools.
- Growth is off by default; when on, only small ongoing changes. The island's shape follows the
  plan (an earlier try let a growth simulation shape the whole island: it came out terraced
  everywhere, wonderland-grow/notes.md).
- The island is carved from an SDF, 500–600 m across, shaded per pixel from the field.

- 2026-10-25: the whole island by rule (`wonderland-world-plan.md`): the layout from the seed and
  design relations, not coordinates; the hall removed (it may return with a cultural role and a
  use); pavilions, bridge, landing and lookout wait for sites and routes, placed by their use.

## Open questions

- The blockout's proportions, part by part, as each is built.
