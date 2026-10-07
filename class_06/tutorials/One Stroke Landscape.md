# Class 06 — One Stroke Landscape 一笔山河

Draw one stroke on an empty landscape. It becomes a river (or a road) that carves the ground; life regrows around it by rules; and the water you drew flows, carrying thousands of particles that leave brush-stroke trails.

One piece, three chapters, one per assignment: **1 Scatter · 2 Path · 3 Flow**, plus **All**.

App: `class_06/react-app-ts/`

```bash
cd class_06/react-app-ts
npm install
npm run dev
```

Default language is **中文**; toggle **EN** in the panel. Two styles: **ink wash 水墨** and **blue-green 青绿**.

**How to play**
- **Look**: drag to orbit, scroll to zoom. **Top view** for the scroll-painting view.
- **Draw river / Draw road**: drag on the land (right-drag still orbits).
- **Drop whirlpool**: click the land; hold Shift for the other spin.
- **Undo stroke / Clear all / New land** (new seed, new starter river).

---

## Course summary notes (what I took away)

### 1. Distributions (scattering / populating)

*Automatically placing many copies of assets over a surface.*

| Technique | Idea |
| --- | --- |
| Random | Uniform random points. Even, but no structure. |
| Noise distribution | Keep a point only where a noise map is high, so things grow in clumps and clearings. |
| Asset differentiation / following maps | Read data from the terrain (height, slope, moisture, biome) to decide *which* asset goes where. |
| Oriented to surface | Align to the ground normal, or keep upright with a random yaw. |
| Slope limit | No trees above a max slope (e.g. 33°): cliffs stay bare. |

**Assignment 1**: a scattering system with one control layer per asset type (what is the rule for it to appear? avoid cliffs? close to water?), plus variation from terrain data (colour, size, density).

### 2. Paths (spline overlays)

Splines add detail on top of a terrain: roads, rivers.

**Assignment 2**: what can be represented as lines? How do 2D lines project onto a 3D mesh? What influence does a spline have on the mesh, and the mesh on the spline?

### 3. Vector fields and particles

- **Particle system**: point data over space; can be drawn as dots, sprites, or **trails**.
- **Forces**: wind, vortex, gravity push particles.
- **Vector field**: a direction (and strength) stored at every point of a grid; particles read it and move.
- **Fluid solver**: a field that evolves over time (currents, vortices, viscosity), as in the river and terrain examples.

**Assignment 3**: a particle system for something without fixed geometry (atmosphere, water, clouds), living in a vector field, drawing trails, represented creatively.

---

## How each assignment is done here

### Chapter 1 — Scatter (`src/world/scatter.ts`)

- **Candidates**: a jittered grid (one random point per 1.1 × 1.1 cell), so points are even but not on a lattice.
- **Each candidate asks the ground** for its height, slope, moisture, distance to river and distance to road (`src/world/terrain.ts` builds these maps). The first species whose rule says yes grows there:

| Layer | Rule | Variation from data |
| --- | --- | --- |
| Rock | only on steep ground (slope > 0.32), more the steeper | shade by height |
| Reed | only on river banks (close to a river, not in it) | taller where wetter |
| Pine | gentle slopes, in clumps (noise > 0.5), not on cliffs / water / road | smaller up high; greener where wet |
| Flower | wet, flat ground | colour shifts with moisture |
| Pavilion | the flattest high spots, at least 18 units apart | — |
| Lantern | along roads, every few units, alternating sides | — |

- Nothing grows in water or on roads. Each layer can be switched off; **Density** scales all of them.
- **Rendering**: one *instanced* mesh per shape: the shape is stored once and drawn at every point.

### Chapter 2 — Path (`src/world/spline.ts`, `src/world/terrain.ts`)

- **Line**: the mouse points (jittery, uneven) are thinned, passed through a **Catmull-Rom spline** and resampled at even spacing.
- **2D → 3D**: the stroke is drawn on the ground plane (x, z); every point gets its height from the terrain, so the line drapes over the hills.
- **Line → mesh**: a *river* carves a channel (vertices near the line are pushed down, with a smooth falloff); a *road* levels the ground along it.
- **Mesh → line, and on to life**: the carved ground gives the river its water height; distance to the line becomes moisture, which moves the reeds, flowers and pines (Chapter 1). Roads get lanterns.

### Chapter 3 — Flow (`src/world/flow.ts`, particles in `src/Landscape.tsx`)

- **Vector field** on an 80 × 80 grid, the sum of three sources:
  1. **River current**: near a river, the flow follows the stroke's tangent, *in the direction it was drawn*.
  2. **Vortices** (whirlpools you drop): a swirl tangent to the circle around the centre, plus a slight pull inward, fading with distance.
  3. **Wind**: a steady direction plus **curl noise** (the gradient of a noise map, turned 90°), which makes eddies without sinks or sources. Over water, wind is weaker than the current.
- **Particles** (default 4,000): every frame each one reads the field where it is and moves; it remembers its last 12 positions, drawn as a line that fades into the paper, like a brush stroke. They are reborn after a few seconds, 60% of them on rivers.
- **Show field arrows** draws the field itself.

### Why one piece instead of three

The interesting part of this class is how the systems feed each other: **the line shapes the ground, the ground decides what grows, and the drawn water drives the flow**. Each chapter isolates one layer for its assignment; **All** shows them together.

---

## Ideas to carry into the final project (Guixu)

- Replace the noise wind on Penglai with a real vector field (curl noise + flow around the peaks) shared by grass, flowers, falls and clouds.
- Rules by layer for future assets (pines, pavilions, creatures), reading the same ground maps.
- Splines for waterfalls, paths and cliff walkways.

## Files

| File | What it does |
| --- | --- |
| `src/world/noise.ts` | seeded random numbers, value noise, fBm |
| `src/world/terrain.ts` | heightmap, carving and levelling by strokes, slope and moisture maps |
| `src/world/spline.ts` | Catmull-Rom smoothing, even resampling, nearest point on a line |
| `src/world/scatter.ts` | the rule layers |
| `src/world/flow.ts` | the vector field |
| `src/Landscape.tsx` | terrain, ribbons, instances, particle trails, arrows, drawing input |
| `src/App.tsx` | state, chapters, tools, panel, top view |
| `src/styles.ts` | ink wash and blue-green colours |
| `src/i18n.tsx` | EN / 中文 text |
