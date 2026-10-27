# Fix pass report: shore → grass → shrub → atlas (2026-10-27)

Plan: `fix-shore-plants-atlas-plan-2026-10-27.md`. No fish / new systems.

## 1. Confirmed root causes

### Shore pale jagged band (seed **5676**)

**Confirmed (code + probe):**
- Water **mesh** emission used `level` after `UNDER_BANK` grow, so stair-edge verts sat centimetres above `groundShore` (same stencil as `flowWater` GROUND shore). Shader soft edge then drew pale sheet fragments on dry bank.
- Evidence: prior `probe-shore-edges` / band samples showed overhang ≤ ~20 cm with stair share ~0.6; after fix `probe-shore-band.ts 5676` → `visibleAboveShore: 0`, `spilling: 0`.
- Files: `water.ts` (`meshLevel` edge clamp to `shoreY+0.04`, drop verts ≤ ground); `flowWater.ts` GROUND `pull = max(aa*2.5, 0.08)` discard inside clip.

**Data split (not conflated):**
| Use | Source |
|-----|--------|
| Drawn sheet Y / coverage | `meshLevel` + GROUND shader pull |
| Soft far paint | blurred mask from physics `level` depth (not physical water) |
| Nav / `waterDepth` / drink | `field.level` + `field.mask` (`level > ground`) |
| Zone wet | zones from water field |

**Guess (marked):** `check-water.ts` still counts **field.level** edges vs shore — e.g. 5676 flow 0.3 reports 2 edges ≤26 cm above shore. That is physics field, not the drawn mesh. Do not treat those as remaining visual fragments without eye check.

### Drinking

**Confirmed:** `check-dwelling.ts 5676 20` — 7752 drinking steps; muzzle off surface ≤ **0.0 cm**; planted feet in water **0**. Drink stand (−104.1, −47.4). Depth at stand from probe ≈ −0.1 m (stand on dry, muzzle into water by design).

### Grass lattice

**Confirmed:** candidates were `(i+0.5)*CELL` with no offset → one clump/cell → visible grid.  
**Fix:** full-cell jitter + `CLUMP_GAP` neighbour reject + re-sample suit/height/water at offset; intra-patch density noise; per-clump R/H/blade/yaw variation. Chunk cache kept; RNG keyed by `(seed,i,j)`.

### Shrub cardboard leaves

**Confirmed:** prior near mesh used large spray diamonds. Replaced with pine-style turtle/tube/`aTone` L-system (`shrubLSystem.ts`) + small tipped blades (`SHRUB_LEAF` L=0.072 W=0.011 unit). At 0.8 m plant: **leaf ≈ 5.8 cm × 1.3 cm**, crown ≈ 1.2 m.

### Atlas proxies

**Confirmed:** cards used decorative 2D icons + fake “1 m”; grass count showed loaded blades as island total (0 when unloaded). Now real generator thumbs/preview, honest loaded vs “全岛未统计”, metre ruler mesh in preview.

---

## 2. Concrete edits

| Area | Files | Rule change |
|------|-------|-------------|
| Shore | `water.ts`, `flowWater.ts` | Mesh edge clamp; min 8 cm shader pull-in |
| Grass | `CoverGrass.tsx` | World jitter + gap + local density; keep chunk cache |
| Shrub | `shrubLSystem.ts` (new), `ShrubPatches.tsx` | Multi-stem L-system; pine mat/LOD/instancing; 3 tones |
| Atlas | `ResourceAtlas.tsx`, `resourceCatalog.ts`, `Scene.tsx` | Real pine/grass/flower/shrub/stele preview; tone switch; count honesty |
| Probes | `probe-shore-band.ts`, `probe-grass-centres.ts`, `probe-shrub-tones.ts` | Attribution / centres plot / tone census |

**Pine reuse (shrub):**
- Reused: turtle/tube/`aTone` pattern from `core/generators/pine.ts`; `createPineMaterial` + rim; InstancedMesh LOD buckets + hysteresis; wind via shared pine uniforms (root-fixed tip sway on mat).
- Shrub-only: axiom/rules (`S` multi-stem), `TURTLE` / `SHRUB_LEAF`, `makeShrubLods`, tone buckets. Penglai pine `RULES` untouched.

**LOD tris (variant 0):** near **1349** / mid **892** / far **504**. Only near band uses fine leaves; ~1100 plants never all high-detail.

---

## 3. Visual / script QA

| Item | Result | Eye vs script |
|------|--------|---------------|
| Water shore 5676/684/7/42 | `probe-shore-band` visibleAboveShore=0 all four | **Script**; owner eye on 5676 channel recommended |
| Drinking 5676 | muzzle 0 cm; feet dry | **Script** (`check-dwelling`) |
| Grass arrangement | ASCII centre plot: clustered patches, not lattice rows | **Script** plot; eye before/after pending |
| Shrub near foliage | leaf metrics + L-system; atlas preview wired | **Script** metrics; eye near/mid/far pending |
| Atlas | CN names + fallbacks; real previews; no fake 1 m on thumbs | **Code**; UI smoke pending in browser |

---

## 4. Performance

| Metric | Value |
|--------|-------|
| Water bake (check-water per seed×flow) | ~1.2–1.5 s |
| Shrub grow | 684: 19 ms; 7: 48 ms; 42: 13 ms |
| Shrub LOD tris / plant | 1349 / 892 / 504 |
| Island draw calls / tris same camera | **未测** (no GPU capture this pass) |
| GPU | **未测** |

---

## 5. Water flags (per seed, default flows in `check-water`)

Do not collapse to problem totals only:

| Seed | Notable flags |
|------|----------------|
| **684** | flow 0.3: 2 mesh-edge field spills (0 under shore clip in checker); flow 3: pool1 5 off-water steps; else pools OK |
| **7** | flow 0.3: 1 edge under shore clip; plunge→rim 11/24; flow 3/15: 1 missed inflow particle each |
| **42** | clean across flows; plunge off-steps at flow 0.3 only |
| **5676** | flow 0.3: 2 field edges ≤26 cm above shore (**field**, not mesh); plunge 15/24; flow 3: 4 field edges ≤3 cm; flow 15 clean edges |
| **1234** | flow 3: 1 missed pool particle; flow 15: 1 edge under clip |

`probe-shore-band` (default flow) for 5676/684/7/42: **0** visible-above-shore on the band metric used for the pale fragment bug.

---

## 6. Shrub tones (census)

| Seed | Grey-green | Ochre | Vermillion |
|------|------------|-------|------------|
| **684** | 28 patches / 841 plants (76.5%), 8538 m² | 8 / 259 (23.5%), 2400 m² | **0 / 0** |
| **5676** | 25 / 738 (85.4%), 7455 m² | 2 / 74 (8.6%), 810 m² | 3 / 52 (6.0%), 773 m² |

No single giant ochre blob. Vermillion absent on 684 is weight luck (5%), not a yellow monoculture — **no quota rewrite this pass**. All LODs share plant `tone`.

---

## 7. Remaining + handoff

1. Owner eye: seed **5676** main channel bank; grass overhead vs eye-height same pose; shrub near→far continuity; atlas open/close (WebGL dispose).
2. Optional: align `check-water` edge metric with `meshLevel` so field≠mesh is explicit.
3. Optional: seed-driven vermillion floor if 684-style zero-red becomes a show issue.
4. Fish / creature mesh atlas — deferred.

**Reproduce**
```
cd final_project
npx vite --port 5180 --strictPort
# /#/atlas/wonderland-terrain · seeds 5676, 684, 7, 42
npx tsc --noEmit
npx tsx scripts/probe-shore-band.ts 5676
npx tsx scripts/check-dwelling.ts 5676 20 0
npx tsx scripts/probe-grass-centres.ts 684 -80 40
npx tsx scripts/probe-shrub-tones.ts 684,5676
npx tsx scripts/check-water.ts
npx tsx scripts/check-shrubs.ts 684,7,42
```

**Read:** this file → plan → `water.ts` / `flowWater.ts` → `CoverGrass.tsx` → `shrubLSystem.ts` / `ShrubPatches.tsx` → `ResourceAtlas.tsx` → `wonderland-handoff.md`.
