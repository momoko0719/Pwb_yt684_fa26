# Class 03 — Noise & Procedural Terrain

**Course:** Design 4197-6197 · Procedural World Building  
**Date:** September 9, 2026  
**App folder:** `class_03/react-app-ts/`

---

## Exercise overview

Build an interactive noise explorer that:

- Visualises noise equations in **2D** (flat map) and **3D** (displaced terrain)
- Lets you switch between views in real time
- Provides a **layer system** so you can blend multiple noise equations
- Exposes **parametric controls** (sliders, dropdowns) for every math parameter
- Shows **shaping functions** that transform raw noise into different surface types

---

## Concepts covered

### 1. What is noise?

In procedural generation, *noise* is a function `f(x, y) → value` that returns a pseudo-random number for any 2D coordinate — but with one crucial property: **nearby coordinates return similar values**. This *spatial coherence* is what makes noise useful for terrain, clouds, and textures.

Without coherence you would get white noise (random pixels with no structure). With coherence you get organic, flowing patterns.

---

### 2. Noise types implemented

#### Perlin Noise
Classic gradient noise by Ken Perlin (1983). The space is divided into a grid; at each grid vertex a random *gradient* vector is stored. The noise value at any point is computed by dot-producting the distance vector with the surrounding gradients and blending with a smooth interpolation curve (`6t⁵ − 15t⁴ + 10t³`).

**Pros:** smooth, natural, no obvious grid artifacts  
**Cons:** slightly more expensive than value noise

```
// Key formula (fade function)
fade(t) = t³(t(6t − 15) + 10)
```

#### Value Noise
A simpler approach: assign a random scalar value to each grid vertex, then bicubic-interpolate between them. Cheaper than Perlin but can have a blockier, more visible grid structure at low frequencies.

#### Worley / Cellular Noise
Scatter random *feature points* across space. The noise value at any coordinate is the distance to the nearest feature point. Produces organic cell and crack patterns — good for rock surfaces, skin, scales, and water caustics.

```
worley(x, y) = 1 − distance_to_nearest_feature_point
```

---

### 3. Fractal Brownian Motion (fBm)

A single octave of noise looks smooth and simple. **fBm** stacks multiple octaves of the same noise at increasing frequencies and decreasing amplitudes:

```
fBm(x, y) = Σ amplitude_i × noise(x × frequency_i, y × frequency_i)
```

Each octave adds finer detail. The two key parameters are:

| Parameter | Effect |
| --- | --- |
| **Persistence** (0–1) | How much amplitude each octave retains. High = rough detail. |
| **Lacunarity** (>1) | How much the frequency increases per octave. 2.0 = doubles each time. |
| **Octaves** | Number of detail layers stacked. |

---

### 4. Shaping functions

Raw noise values sit in 0–1. *Shaping functions* (transfer functions) remap this range to change the visual character before the value is used as a height or colour:

| Function | Math | Visual result |
| --- | --- | --- |
| **Linear** | `f(t) = t` | No change |
| **Smooth Step** | `f(t) = t²(3 − 2t)` | Gentle S-curve, softens extreme values |
| **Power** | `f(t) = tⁿ` | n<1 flattens, n>1 accentuates peaks — good for mountain-like erosion |
| **Absolute** | `f(t) = \|2t − 1\|` | V-shape; ridges at zero crossings |
| **Billow** | `f(t) = 1 − \|2t − 1\|` | Inverted abs; soft rounded bumps |
| **Ridged** | `f(t) = (1 − \|2t − 1\|)²` | Sharp mountain ridges |
| **Terrace** | `f(t) = round(t × steps) / steps` | Quantised plateaus and cliffs |

---

### 5. Layer blending

Multiple noise layers are combined sequentially. Each layer has an **opacity** (weight) and a **blend mode**:

| Blend mode | Formula | Use |
| --- | --- | --- |
| **Add** | `result += layer × opacity` | Stack detail on top of base |
| **Multiply** | `result *= lerp(1, layer, opacity)` | Mask out or modulate amplitude |
| **Subtract** | `result -= layer × opacity` | Carve features out |
| **Max** | `result = max(result, layer × opacity)` | Overlay only the highest values |

The final value is clamped to 0–1 before rendering.

---

### 6. 3D terrain generation

A flat `PlaneGeometry(10, 10, N-1, N-1)` is created with N² vertices. After computing the noise map, each vertex's Z coordinate (perpendicular to the plane before rotation) is displaced by:

```
vertex.z = noiseMap[row × N + col] × heightScale
```

The mesh is then rotated −90° around X to lie horizontally. Vertex normals are recomputed to get correct lighting.

---

## File structure

```
class_03/react-app-ts/src/
├── types.ts                  — shared TypeScript types and metadata
├── lib/
│   ├── noise.ts              — Perlin, Value, Worley noise + fBm
│   ├── shaping.ts            — shaping / transfer functions
│   ├── computeMap.ts         — blends layers → Float32Array noise map
│   └── colors.ts             — maps noise values to RGB (greyscale, terrain, heatmap)
├── components/
│   ├── InfoTooltip.tsx       — ⓘ hover tooltip
│   ├── NoiseCanvas2D.tsx     — 2D canvas pixel renderer
│   ├── Terrain3D.tsx         — Three.js displaced plane scene
│   ├── LayerCard.tsx         — single layer control UI
│   └── LayerPanel.tsx        — layer list with add / remove / reorder
└── App.tsx                   — main layout, state, view toggle
```

---

## 7. Hydraulic Erosion Simulation

### What is hydraulic erosion?

Hydraulic erosion is the real-world process by which flowing water reshapes the land:

```
🌧️  Rain falls on the surface
   ↓
🌊  Water flows downhill (follows gradient)
   ↓
🏔️  Picks up loose sediment (soil/rock particles) on steep slopes
   ↓
🏞️  Deposits sediment where slope flattens (valleys, plains)
   ↓
⛰️  Over time: sharp ridges, carved valleys, smooth alluvial plains
```

**Before erosion** — raw noise:
```
▄▅▆▅▄▅▆▄▅▆▅▄   bumpy everywhere, no directionality
```
**After erosion** — geologically believable:
```
▁▂▅▆▅▂▁▂▅▆▅▂   valleys carved, peaks worn, sediment deposited
```

### Why it matters

Pure noise has no sense of water flow. Erosion adds:
- **Natural river channels** that emerge from nothing
- **Eroded ridgelines** that shed water left and right
- **Sediment plains** at the base of mountains (alluvial fans)
- **Visual realism** matching satellite topography

### Algorithm (particle-based, Beyer 2015)

Each simulated water droplet follows these steps:

| Step | What happens | Geography it creates |
|---|---|---|
| 1. Spawn | Droplet placed at random position | Rain falling anywhere |
| 2. Flow | Moves downhill following slope gradient | Stream following terrain |
| 3. Erode | Picks up sediment when fast/steep | Valley carving |
| 4. Deposit | Drops sediment when slow/flat | Alluvial plains |
| 5. Evaporate | Water gradually disappears | Finite stream length |

### Simulation controls

| Control | Effect |
|---|---|
| ▶ Play | Run erosion — watch terrain change step by step |
| ⏸ Pause | Freeze at current step |
| ⏮ Reset | Go back to raw noise (no erosion) |
| Timeline slider | Scrub backward through erosion history |
| Droplets / Step | More droplets = stronger erosion per tick |
| Inertia | 0 = streams meander wildly; high = straight rivers |
| Erosion Rate | How aggressively peaks are worn down |
| Deposit Rate | How quickly valleys fill with sediment |

---

## 8. Explore Mode (First-Person Navigation)

Switch from orbit camera to fly-through mode to explore the terrain as if walking through it.

### Keyboard controls

| Key | Action |
|---|---|
| `W` / `↑` | Move forward (along camera facing) |
| `S` / `↓` | Move backward |
| `A` / `←` | Strafe left |
| `D` / `→` | Strafe right |
| `Q` | Rise upward |
| `E` | Descend |
| Fly Speed slider | Adjust movement speed |

### Why it's useful

Orbiting gives a bird's-eye overview. Exploring lets you:
- Feel the scale of individual mountains
- See how erosion channels look at ground level
- Appreciate the transition from water to forest to snow

---

## 9. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Tab` | Toggle 2D map ↔ 3D terrain |
| `Space` | Play / Pause erosion simulation |
| `F` | Toggle wireframe on/off |
| `G` | Toggle explore / orbit mode |
| `R` | Reset erosion (back to base noise) |

---

## How to run

```bash
cd class_03/react-app-ts
npm install
npm run dev
# open http://localhost:5173
```

---

## Experiments to try

- [ ] Add a third layer with **Worley** noise on **Subtract** blend mode — watch it carve river-like valleys
- [ ] Set shaping to **Terrace** (steps = 5) for a stepped landscape / Minecraft look
- [ ] Try **Ridged** shaping on a Perlin layer with high lacunarity for mountain spines
- [ ] Enable **Wireframe** mode to see how many triangles make up the mesh at different resolutions
- [ ] Compare resolution 32 vs 128 vs 256 — note the trade-off between performance and detail

---

## References

- [Ken Perlin's original noise paper (1985)](https://mrl.cs.nyu.edu/~perlin/paper445.pdf)
- [Inigo Quilez — Articles on noise and shaping](https://iquilezles.org/articles/)
- [The Book of Shaders — Noise chapter](https://thebookofshaders.com/11/)
- [Catlike Coding — Noise series](https://catlikecoding.com/unity/tutorials/pseudorandom-noise/)
