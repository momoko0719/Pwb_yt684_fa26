# Class 07 — Penglai Pines 蓬莱松 (Assignment 1: L-systems + LOD)

A tree written as a sentence. Rules rewrite a short string again and again; a 3D turtle walks the string and leaves branches and needle pads. Then the same pine is planted 1,200 times on a mountain, and every tree picks its level of detail by its distance to the camera.

App: `class_07/react-app-ts/`

```bash
cd class_07/react-app-ts
npm install
npm run dev
```

Default language is **中文**; toggle **EN** in the panel.

- **1 One tree**: pick a preset (welcome pine, weeping willow, textbook plant, hanging vine), edit the axiom and rules live, move the sliders, watch the string grow generation by generation, and compare **LOD0 / LOD1 / LOD2** side by side.
- **2 A forest (LOD)**: 100–3,000 trees, LOD on/off, tint by level, the two switching distances, and live FPS / triangles drawn / trees per level.

---

## Course summary notes (what I took away)

### Part 1 — Branching systems

| Idea | What it means |
| --- | --- |
| **L-system** | A grammar: an *axiom* (start string) and *rules* (`A = F+A`). Each generation replaces every letter by its rule, in parallel. The string grows; the structure is in the rules. |
| **Turtle** | The string is read as drawing commands: `F` forward, `+ −` turn, `[ ]` save / restore the position, which is what makes branches. |
| **Recursion** | The same rule applied to its own output: Koch curve, Sierpinski triangle, a Y that keeps splitting into Ys. |
| **Layers of detail in real tree tools** | Trunk (grammar + noise + gravity + taper), branches, leaf clusters, then a stylised shader. Ivy is the same idea crawling on or hanging from a surface. |
| **LOD (Levels of Detail)** | Several versions of one asset, from full to a few hundred triangles, swapped by camera distance. A forest of ~1,650 trees stays fast because only the closest ones are full detail. |

**Assignment 1**: How can L-systems generate geometry (trees, ivy, other cases)? How can a procedural system be defined with LODs, and how would the app use them to keep the frame rate up?

### Part 2 — Branching worlds (for Assignment 2, see the separate notes)

Borges' *The Garden of Forking Paths*; branching narratives (a civilisation choosing *consume* or *steward* era after era, ending in collapse, exodus, fragile balance or flourishing); **Microscope**, a game where players write a world's history together between two fixed "bookends", with cards marked flourishing or strained, each tied to something already on the table. The result is "a collectively authored world database".

---

## How Assignment 1 is done here

### The grammar (`src/world/lsystem.ts`)

- **Symbols**: `F` forward · `+ −` yaw · `& ^` pitch · `\ /` roll · `*` roll by the golden angle 137.5° (side branches spiral like real phyllotaxis) · `[ ]` branch · `L` leaf pad. Other letters (`A`, `B`, `C`, `V`) are **buds**: they only matter for rewriting, and the buds still left at the end become needle pads, so the tips are green.
- **Stochastic rules**: several lines for the same letter, each with a weight, e.g.
  ```
  A = F[&B]*A      : 0.4    # one limb, then keep climbing
  A = F[&B]**[&B]*A : 0.35  # two limbs
  A = FA           : 0.25   # a bare stretch of trunk
  ```
  The seed decides which rule is chosen each time, so the same grammar gives a family of different trees.
- **Turtle in 3D**: an orthonormal frame (heading, left, up). Every `F` adds a small random bend (*jitter*), tapers the branch, and pulls the heading toward the ground (*gravity*, tropism). Side branches are shorter and thinner (*length / width decay*).
- **Presets, one engine**:

| Preset | What changes |
| --- | --- |
| Welcome pine 迎客松 | irregular whorls of nearly level limbs (72°), twigs left and right, flat cloud-shaped needle pads |
| Weeping willow 垂柳 | similar grammar, strong gravity: branches arc over and hang |
| Textbook plant | `F = F[+F]F[-F]F`, 25.7°, no randomness: the classic figure from *The Algorithmic Beauty of Plants* |
| Hanging vine 垂藤 | starts heading **down** from a floating rock, sometimes splits; an answer to "ivy / other cases" |

### LOD from the grammar itself (`src/world/lod.ts`)

The key idea: **detail = recursion depth**. Every branch segment and leaf knows its bracket depth and which branch owns it at each depth, so a coarser level is just "stop at depth *d* and summarise what is below":

| Level | Keeps | Replaces | Pine (one tree) |
| --- | --- | --- | --- |
| **LOD0** | every twig and pad, 7-sided branches | — | 4,590 triangles |
| **LOD1** | trunk + main limbs (depth < 2), 4-sided | the pads of each twig merge into one bigger pad | 1,232 triangles |
| **LOD2** | trunk only, 3-sided | each main limb becomes one pad (or one stick if it has no leaves) | 132 triangles |

Far away you cannot see a twig, but you can still see where the green masses are, so every level keeps the **silhouette** and drops the **detail**. All three are built once from the same skeleton.

### Using it for frame rate (`src/Scenes.tsx`, `ForestScene`)

- 4 seeded variants × 3 levels = 12 **instanced meshes**. Each tree's matrix is computed once.
- Every frame, each tree measures its distance to the camera and is written into the instance list of the level it needs (`LOD1 beyond` / `LOD2 beyond` sliders). Nothing is rebuilt, only the instance counts change.
- Measured, same view, 1,200 trees: **LOD on ≈ 0.73 M triangles** (502 at LOD1, 698 at LOD2) vs **LOD off ≈ 5.2 M triangles** (all LOD0): about **7× less** geometry.
- **Tint by level** colours LOD0 vermilion, LOD1 ochre, LOD2 azurite, so you can watch the rings move with the camera.
- Placement reuses last week's scattering: random candidates kept only on land, on gentle slopes, in noise clumps.

### Other cases for L-systems

Roots under a floating island, hanging vines and ivy, river deltas and waterfalls that split, lightning, coral, cracks in ice or glaze, street networks, even a family tree or a history (Assignment 2).

---

## Ideas to carry into the final project (Guixu)

- The welcome-pine grammar for Penglai's cliffs; gravity and the slope at the spot could set the limb angle (cliff pines lean out over the void).
- Hanging vines and roots for the underside of the islands.
- Depth-based LOD for every grown asset, so all five islands can be on screen at once.

## Files

| File | What it does |
| --- | --- |
| `src/world/lsystem.ts` | rule parser, stochastic expansion, 3D turtle → skeleton |
| `src/world/lod.ts` | skeleton → mesh at LOD0 / 1 / 2 (cut by depth, merge pads per owning branch) |
| `src/world/presets.ts` | the four grammars and their parameters |
| `src/world/island.ts` | the forest mountain and tree placement |
| `src/world/noise.ts` | seeded random numbers, value noise, fBm |
| `src/Scenes.tsx` | one-tree scene, LOD comparison, instanced forest with per-frame LOD choice |
| `src/App.tsx` | state and panel |
| `src/i18n.tsx` | EN / 中文 text |
