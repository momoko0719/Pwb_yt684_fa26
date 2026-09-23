# Class 04 — Clay Studio (summary & notes)

**App:** `class_04/react-app-ts/`  
**Metaphor:** a pottery studio — pinch clay, cut it, glaze it, only fire nearby tiles.  
**Languages:** English default · 中文 toggle · textbook names optional (“Show textbook names”).

Related: [Firebase — Auth, Firestore, Storage, Hosting](./Firebase%20Auth%20Firestore%20Storage%20Hosting.md) (Assignment 2).

---

## One-sentence summary

Class 04 moves from **2D heightmaps** (Class 03) to **3D volumes**: every point can be solid or empty. You explore **density recipes**, **CSG cuts**, **meshing (how to draw)**, and **chunking (why big worlds must split)**.

---

## Learning outcomes

| You can… | Plain talk | Textbook |
| --- | --- | --- |
| Describe a density field | Ask every point: clay or air? | Density / scalar field |
| Pick shapes for a look | Hills, sponge, islands, planet… | Density shapes |
| Combine volumes | Stick, dig, melt, hollow | CSG + SDF ops |
| Compare draws | Blocky bricks vs smooth skin | Culled faces vs Marching Cubes |
| Explain chunking | Don’t bake the whole kiln | Streaming / chunks |
| Name cave strategies | Easy point checks vs path diggers | Threshold, worms, CA… |

---

## The four stations

### 1 · Pinch (Density)

**Idea:** a number at `(x,y,z)`. Above a threshold → solid.

| Recipe (UI) | Gives | Notes |
| --- | --- | --- |
| Rolling hills | Walkable ground | `h(x,z) − y` heightfield |
| Sea sponge | Diggable blob | 3D fBm |
| Paper walls | Thin sheets | Ridged — *intentionally* thin |
| Rice terraces | Steps / cliffs | Quantized height |
| Sky islands | Floating chunks | Noise × height band |
| Little planet | Sphere world | `R + h − length(p)` |
| Layer cake | Stripes in a cut | Strata |

**Display note:** Station 1 uses **blocky solid voxels** so clay feels thick. A **smooth skin** (Marching Cubes) can look like paper on heightfields — both are valid; Station 3 compares them.

### 2 · Cut (CSG / SDF)

SDF: **negative = inside**. Combine with:

| Tool (UI) | Formula | Use |
| --- | --- | --- |
| Stick together | `min(a,b)` | Union |
| Keep overlap | `max(a,b)` | Intersection |
| Dig a hole | `max(a,−b)` | Subtraction |
| Melt together | `smin(a,b,k)` | Smooth union |
| Hollow out | `abs(a)−t` | Shell |

Think **sequential** pipelines: ground → dig caves → add rocks → shell a room.

### 3 · Glaze (Meshing)

GPU draws triangles. Same density, different finish:

| Glaze | Method | Feel |
| --- | --- | --- |
| Blocky | Culled faces | Minecraft-y, cheap |
| Smooth | Marching Cubes | Organic, more tris |

Others (reference): Greedy, Marching Tetrahedra, Surface Nets, Dual Contouring (sharp edges, Hermite data).

### 4 · Fire nearby (Chunking)

Cost grows ~ `N³`. Only load tiles near the player.  
Cave methods: **evaluative** (threshold, intersection) vs **path/history** (worms, 3D CA) — the latter stress chunk borders.

---

## What we built in code

| Path | Role |
| --- | --- |
| `src/lib/density.ts` | Shape recipes |
| `src/lib/sdf.ts` | Primitives + CSG |
| `src/lib/meshCulled.ts` | Blocky glaze |
| `src/lib/meshMarchingCubes.ts` | Smooth glaze |
| `src/lib/firebase.ts` | Firebase init |
| `src/components/CloudBar.tsx` | Sign in · save/load config |
| `src/i18n/` | EN + 中文 studio voice |

---

## Assignment 1 checklist (voxel / density)

- [x] Voxel terrain in its own views (stations)
- [x] Multiple density shapes
- [x] CSG operations
- [x] Why chunking (interactive + notes)
- [x] Meshing: culled + Marching Cubes
- [x] Alternative meshing documented
- [x] Optimization ideas (chunking, culling, greedy…)

## Assignment 2 checklist (Firebase)

See the [Firebase tutorial](./Firebase%20Auth%20Firestore%20Storage%20Hosting.md).

- [ ] Auth + Firestore + Hosting enabled  
- [ ] Storage skipped for now (no media files; see Firebase tutorial)  
- [ ] Save / load configuration  
- [ ] Public URL shared on the class spreadsheet

---

## Run locally

```bash
cd class_04/react-app-ts
npm install
npm run dev
```

---

## Suggested walk (10 min)

1. Welcome → Start pinching  
2. Hills → Islands → Planet  
3. Dig a hole (Cut)  
4. Flip Blocky / Smooth (Glaze)  
5. Raise world size (Fire nearby)  
6. Optional: Show textbook names  

Then: follow Firebase tutorial → deploy → paste URL.
