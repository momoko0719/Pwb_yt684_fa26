# Class 05 — Shader Lab

## 2026-10 rework: Glaze · Pearl · Glow 琉璃 · 珠光 · 荧光

For the midterm atlas the app was rebuilt as three materials for Guixu, in the same paper, ink and vermilion style as the other class apps (EN/中文). The original twenty-study lab is in git history.

Each material is one hand-written shader (`src/shaders.ts`) on a fitting subject (`src/Specimens.tsx`), with its key line of GLSL in the panel and a **Show mask** switch that draws the 0..1 value behind the colour:

| Material | Subject | Technique | Mask |
| --- | --- | --- | --- |
| **Glaze 琉璃** | a leaning scholar's rock (welded, displaced icosahedron) | glaze gradient by height (deep teal → azure), Fresnel rim in gold, Blinn-Phong highlight | `pow(1 − N·V, power)` |
| **Pearl 珠光** | a two-ring flower with cupped, frilled petals (after the silicone and pearl flowers in the moodboard) | thin-film interference: hue from `cos(2π(thickness·(1 − N·V) + phase))`, softened toward white and strongest at grazing angles; warm light through the petal when the light is behind it; the light circles the flower | `1 − N·V` |
| **Glow 荧光** | a night sea with dark rocks (after the bioluminescent sea in Hong Kong) | waves in the vertex shader (sines + noise); plankton light up on crests (`smoothstep` on height × flickering noise) and in a ring spreading from where the mouse moves (or, when idle, where a fish breaks the surface) | the glow amount |

The notes below describe the original lab.

---

A visual playground for the shader ideas from class: **see an effect → change one control → understand why it changed**.

App: `class_05/react-app-ts/`

```bash
cd class_05/react-app-ts
npm install
npm run dev
```

Default language is **English**; toggle **中文** in the sidebar.

---

## Course summary notes (what I took away)

### Pipeline in one sentence

1. **Vertex shader** — once per vertex: move / deform points.  
2. Triangles get rasterized onto the screen.  
3. **Fragment shader** — once per pixel: decide color (and often a 0→1 **mask** first).  
4. **Uniforms** — knobs from JS (color, power, time…) shared by all vertices/pixels.

**Rule of thumb:** silhouette moving → likely vertex; same shape, new paint → fragment.

### Masks vs materials

Many “fancy” looks are really:

```
mask (0→1)  →  mix(colorA, colorB, mask)  or  rim = mask
```

In the lab, **Show mask** turns off the pretty colors so you only see that grayscale field. Especially useful for Fresnel, slope, distance, contact, AO, and gradients.

### Idea → formula → use (cheat sheet)

| Idea | Core input | Typical use in worlds / sims |
| --- | --- | --- |
| Flat / uniform | One RGB | Debug, base tint |
| Position gradient | `position.x/y/z` | Snow line, water depth, strata |
| Linear vs smoothstep | blend curve | Fog, soft thresholds |
| Bezier remap | custom ease | Art-directed transitions |
| Equation field | `sin`, `length`, … | Procedural patterns without textures |
| Fresnel | `1 − N·V` | Glass, water rim, shields |
| Slope | `1 − \|N.y\|` | Rock on cliffs, grass on flats |
| Distance | `distance(p, hotspot)` | Brush falloff, heat, proximity |
| AO (approx.) | creases / near floor | Grounding, readable form |
| Contact | height to ground | Soft contact shadow / stain |
| Matcap | view-space normal → sphere look-up | Fast stylized lighting |
| Displacement | `pos += N * (wave/noise)` | Sea, asteroid crust, idle motion |
| Combo | displace + contact + noise | How small tricks stack into “alive” surfaces |

### Big inspirations for later work (final project)

- **Shaders are strategy switches**, not one giant material. Swap Fresnel vs slope vs distance like Clay Studio stations.  
- **Simulation look** often comes from *spatial fields* (height, slope, distance, contact) painted onto geometry — not only from particles.  
- **Displace first, shade second** is a strong recipe for living terrain / creatures.  
- Keeping **mask visible** while designing prevents “pretty but I don’t know why.”

---

## What the website is

Not ShaderToy. One 3D stage + side panel of **studies**. Each study has:

- Name + short line  
- **Meaning / Good for / Try this / Takeaway** (EN + 中文)  
- Sliders  
- Optional mask toggle  
- Tiny GLSL snippet (read-only)

Feel: a small **digital material laboratory**.

---

## Study map (app sections)

### 1 · Basics
Vertex · Fragment · Flat / Uniform  

### 2 · Gradients
Position-based · Linear / Smooth · Bezier · Equation-based  

### 3 · Spatial
Fresnel · Slope · Distance · Ambient Occlusion  

### 4 · Materials
Contact · Matcap  

### 5 · Geometry
Vertex Displacement  

### 6 · Combine
Contact + Noise + Displacement  

---

## How to play

1. Read the welcome card.  
2. Follow **Try this** — change **one** slider.  
3. Toggle **Show mask** when available.  
4. Read **Good for** + **Takeaway**.  
5. Press **Next study** (suggested path) or jump in the list.

Suggested path baked in the UI:  
Basics → Gradients → Fresnel → Slope → Distance → Contact → Displace → Combo.

---

## Assignment angle

Shows:

- Shader **logic** (stages, uniforms, masks)  
- What shaders can do for **simulation-looking** materials  
- Switching **strategies** in one lab  

Clarity over production-perfect AO or a full node graph.

---

## Code map

| Path | Role |
| --- | --- |
| `src/i18n/` | EN/ZH UI + per-study pedagogy |
| `src/studies/catalog.ts` | Params + snippets |
| `src/components/StudyScene.tsx` | GLSL per study |
| `src/components/Viewport.tsx` | R3F canvas |
| `src/components/SidePanel.tsx` | Nav + controls + guide cards |
| `src/App.tsx` | Welcome + lab shell |

---

## Learning outcomes checklist

- [ ] I can say what runs in **vertex** vs **fragment**.  
- [ ] I can explain a **mask** vs final color.  
- [ ] I can link Fresnel / slope / distance / contact to **spatial inputs**.  
- [ ] I can describe how **displace + contact + noise** stack.  
- [ ] I have at least one idea for using a shader strategy in my **final world**.
