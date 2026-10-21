# Wonderland — design

Status: agreed direction and art direction, 2026-10-21.

**Where it lives**: a new island in the Atlas, **Wonderland** (`src/experiments/wonderland/`). It
does not replace Penglai Island v1, which stays as the realistic-scale study (forest kept to
10–20% of its top). Wonderland reuses Penglai's generators (terrain, scale system, water
algorithm, LOD, wind, solar terms, pavilion grammar) and adds its own.

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

From *The Peach Blossom Spring* the world borrows only a way of arriving: follow the water, pass
through a narrow opening, and the land opens out.

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
  vertical white lines; hanging rock under the island drawn out into icicle-like drips.
- **Open space.** Large calm areas of white ground, still water and cloud.

### Two modes, following the hour

| | Day: white porcelain (白瓷) | Night: mother-of-pearl on black lacquer (螺钿) |
|---|---|---|
| Ground | ivory white `#F4F1EA`, warm shadow `#DCD8CF`, cool shadow `#BAC4C5` | black lacquer `#121314` around; the island in pearl `#E8E2DA` |
| Layering | soft steps and terrace edges catch light | fine concentric contour lines, pearl pink `#E2C6BE` and pearl teal `#8FB9B3` iridescence |
| Plants | celadon `#A9C4B8` or white canopies, gold trunks | gold trees, a cyan glow `#A8E6DE` in blossoms |
| Water | milky pale turquoise `#C3DED8`, white where it spills | silver lines, pearl reflections |
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

1. **Land at the western rim**: the fall drops into the cloud sea.
2. **Follow the water up**: a stair of travertine pools climbs inland, jewel-tree groves on the
   banks.
3. **The pass**: a narrow gap in the ring of peaks.
4. **It opens out**: an inner basin of jade terraces and pools, buildings on the dry steps.
5. **The summit lookout**: the whole island and Guixu below.

## Systems

### 1. Landform: a ring of peaks and a pass

- **Rule**: the main peak stands at the back; spires are placed along an arc around an inner basin
  (a placement rule replacing free scatter). The **pass is found, not placed**: the lowest saddle
  in the ring, facing the rim the water will leave by.
- **Technique**: distance masks, power curves, smooth union (03, 04).
- **Scale**: island ~1.1 km across, main peak ~120 m, spires 0.4–0.7 of it (docs/scale.md);
  pass 20–40 m wide (judgement).

### 2. Water and travertine terraces

- **Rule**: flow accumulation (built) finds where water runs. Then a deposition simulation: each
  simulated year, calcium carbonate settles where water flows, at a rate proportional to its
  speed (Hammer et al. 2007; Goldenfeld et al. 2006,
  [arXiv](https://arxiv.org/pdf/physics/0601116)); speed is highest where water spills over a
  lip, so lips build up into rims, rims dam pools, and a stair of pools emerges. Larger rims grow
  faster and overtake smaller ones downstream, as observed. The inner basin's pond is the head of
  the stair; the stair runs through the pass to the rim; the falls are where it leaves.
- **Technique**: map simulation (04), heightmap editing (03), the pool water shader (05).
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

White birds and beasts (the owner will choose them). The plan reserves habitats (meadow, grove
edges, pool sides) and home sites; creatures move along routes and zone edges (sessions 9–10).

## What we keep, change, add

| Keep | Change | Add |
|---|---|---|
| terrain generators, underside, scale system and scale view, wind field, solar terms, hour, lone pines (L-system, LOD), grass and Zhuyu, pavilion grammar, falls, water shader, cloud sea, walking | peak placement (ring and pass), meadow rule (from open ground, not a slope threshold), water (one stair from pond to rim), forest (grown groves, a few thousand trees), paths (network between sites) | site scoring, travertine deposition, vegetation growth, jewel trees, building growth (platforms, halls, bridges), jade/pearl/glow materials, bloom and mist, a plan view (map of zones, sites, routes) |

## Budgets

60 fps on a laptop; under ~1.5 M triangles drawn; a rebuild under ~1 s (long simulations run
once per seed and are cached, or run visibly as "growth"). Measured and shown in the page.

## Build order

1. Plan view and the landform ring with its pass.
2. Water: the travertine deposition stair, the pond, the falls.
3. Vegetation growth with jewel trees; meadow from open ground.
4. Site scoring and routes.
5. Building growth.
6. Look: jade, pearl, glow, bloom, mist.
7. Creature habitats, then creatures.

## Open questions

- Which way the pass faces (proposed: west, toward the sunset and the landing).
- The inner basin higher than the outer plateau (a raised terrace) or lower (a hidden valley).
- Whether growth is shown as an animation (the island growing from bare rock) or only its result.
