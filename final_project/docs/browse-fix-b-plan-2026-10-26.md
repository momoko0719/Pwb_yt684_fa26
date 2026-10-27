# Browse fix B — plan (2026-10-26)

**Order:** near/far cover handoff → pivot stuck → grass stream cleanup → Walk dwelling → acceptance.  
No global grass amount / new trees / buildings / mid impostors this pass.

## Must-read

| File | Why |
|---|---|
| `core/terrain/cdlod.ts` | Cover tint + soil; `bladeHandoff` on per-fragment `dist` |
| `Scene.tsx` Ground `useFrame` | Floor clamp; Walk dwell gate `run && !view.walk` |
| `OrbitFocus.tsx` / `OrbitNavDiag.tsx` | Focus anim; stuck evidence |
| `coverFocus.ts` / `CoverGrass.tsx` | Load/fade/miss sticky (frames → seconds) |
| Owner screenshots | `cam↔target≈3`, `minDist HIT`, hit 80–200 m |

## 1. Cover handoff

Confirmed: `dist = length(camera − vWorld)` is **per surface point**, not one island-wide fade.  
Bug: soil/moss and canopy-sim tint share one `carpet × (1−0.78×handoff)` → near ground goes white.

Split:
- **Ground** (soil/moss under real density): keep near (no/low handoff).
- **Canopy proxy tint** (`uCoverTint` fleck): reduce ~25–35% when near blades; trial start.

Wet stone / litter / jade mixes untouched.

## 2. Pivot stuck

Reproduce: zoom/pan until target sits ~3 m from camera while cursor still hits far ground → wheel cannot close in.

Fix: on zoom-in at minDistance, if valid far ground hit, soft-reanchor **target** toward hit with camera held (look shift minimal when hit≈view centre). No per-frame mouse stick, no lower minDistance, no dig.

## 3. Grass stream

Single parameter table in code + docs. Miss hold in **seconds**. No full clear on brief ray miss. Refocus only on focus move / load band.

## 4. Walk dwelling

`run: dwell.run` only. Run toggle still pauses. Measure cost only if needed; no silent ×30 change.

## 5. Acceptance

Seed 684, debug overlays off: wet shore / grove edge / look up-down / chunk pan / unstick minDist / wheel flat-slope-water / Walk approach creature.

## Docs after

`browse-fix-b-2026-10-26.md`, handoff, world-plan, presentation-notes.
