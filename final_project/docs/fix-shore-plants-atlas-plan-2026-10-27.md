# Fix pass: shore → grass → shrub → atlas (2026-10-27)

No fish / new systems. Order is fixed; verify after each stage.

## Order & checks

### 1. Shore + drinking (seed **5676** first)

**Reproduce**  
`/#/atlas/wonderland-terrain` seed 5676 — pale jagged band beside main channel. Note camera / xz.

**Attribute (do not guess)**  
```
npx tsx scripts/probe-shore-edges.ts 5676
npx tsx scripts/check-water.ts          # also run 5676; explain flag deltas per seed
npx tsx scripts/check-dwelling.ts 5676 30 0 scripts/out/dwell-5676.png
```
Compare for the band: final height vs displayed CDLOD; sheet Y / mesh extent / `groundShore` visible clip; zone mask vs `waterDepth` vs drink solver. Soft paint ≠ physics water.

**Fix bar**  
No hide-region / widen water label / loosen drink thresholds. Soft shore OK; no orphan sheet fragments on dry bank. Retest **5676, 684, 7, 42** with per-flag commentary.

**Drink**  
Only when `activity===drink`; log muzzle xz+y, four feet, target water, coords. Muzzle must be over **real visible** water (level), not soft mask alone.

### 2. Grass clump lattice

Inspect `CoverGrass.buildChunk`: cell centres, jitter, one-clump/cell, RNG cross-chunk. Emit top-down clump-centre plot (script or debug) to separate placement vs blade shape.

**Direction**  
Keep chunk cache; deterministic world scatter with neighbour spacing; re-sample height/suit/water after offset; intra-patch density variation; vary clump R / H / blade count / yaw; keep count ≈ same; same seed → same after unload/reload; no chunk-edge seams.

Before/after: same overhead + eye-height.

### 3. Shrubs — reuse pine branch framework

**First** inventory pine (`core/generators/pine.ts`, `shaders/pine.ts`, `Vegetation.tsx`): what to reuse vs shrub-only config. Do not retune Penglai pine rules.

- Low multi-stem outward shrub params on shared turtle/tube ideas; one structure × 3 tones.
- Leaves: small narrow tipped blades along secondary twigs (not pine needles, not large diamonds); report leaf L×W vs 0.4–1.2 m plant.
- Reuse instancing / LOD / rim; optional low wind tip sway; same plant params all LODs.
- Tone census for 684 & 5676 (patches/plants/area); all LODs same `tone`; quota only if one huge yellow blob.

Validate in **Resource atlas** (real generator) before island eye-check.

### 4. Atlas readable

CN names + fallbacks; thumbs from real generators; detail = scene generators/materials; shrub 3 tones; separate config / sample / island sizes; grass/flower counts honest (loaded vs anchors — never show island 0 when only unloaded). Real metre ruler. Creatures/terrain: scene thumb + locate + limits (no cone/cube proxies).

One detail renderer; dispose preview-only; do not dispose shared island materials.

## Report format (into pass MD + handoff)

1. Confirmed root cause (file + evidence); guesses marked.  
2. Concrete edits.  
3. Visual QA per item (eye vs script).  
4. Perf: tris / draws / bake ms at same camera; GPU unmeasured if so (not “panel off”).  
5. Leftovers + reproduce seed/coords/commands/files.

Done when: shore correct, grass not queued, shrub reads as foliage, atlas intelligible.
