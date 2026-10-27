# Cover / stele visual diagnosis baseline — 2026-10-26

Owner screenshots (overview + cover debug, mid with scale, near stele, zones). Seed **684**.
This file is the frozen baseline before the fix pass. Agents continue from here; do not re-diagnose blindly.

## Screenshot evidence (confirmed)

| Shot | What it shows |
|---|---|
| Overview + Cover suitability | Faint green along streams; island mostly grey/white. Panel: **近景草叶 25 · 草丛 27 · 花头 0**. Cover cells>0 = 13459, peak 45%. |
| Mid + Scale view | Stele labelled **巨石 0.9 m**; pine 10.7 m; person 1.7 m. Stele reads as thin white pillar on flat white slab. Island diameter flagged ↓ vs Penglai 800–1200. |
| Near watching stone | Huge rectangular white board into the bank; thin pillar; a few needle-like dark sprigs; no flower; no soil underlayer. |
| Zones overview | Wet shore / woodland / habitat readable as flat colour fills; not a substitute for cover. |

## Stats口径 (confirmed in code)

| Panel label | Meaning |
|---|---|
| 近景草叶 | Instances uploaded to grass InstancedBufferGeometry (`go.length/3`) inside the **~36 m disc around OrbitControls.target** |
| 草丛 | Cells that passed clump-presence (`grassClumps++`), **before** per-blade keep |
| 近景花头 / 花簇 | Same disc, dedicated flower pass only |

**Confirmed bug:** 27 clumps → 25 blades means ~0.9 blades/clump. Code intended 5–11 blades/clump, then applied `if (rng() > dens * …) continue` **per blade**, which rejects most blades when dens ≈ 0.05–0.45. Clumps therefore look like scattered single needles.

## Density semantics (confirmed)

`cover.density` / `cover.at` = **suitability weight in 0..1**, already scaled by `COVER_DEFAULTS.amount`. Not blades/m².
Far tint and near sampling both read the same field. Near sampling then multiplies amount again via `densScale` (double-scale).

## Pipeline sketch (pre-fix)

```
buildCover(zones,grid,seed,amount) → density[]
  → far: cdlod uCover tint (weak mix, farCover fade)
  → near: buildSites around camera target
       cell dens≥0.05 → keep=dens×wear×edge → presence RNG(amount again)
       → clump → for each blade: dens RNG again ← over-filters
       → flower pass dens≥0.14 + flowerShare×dens (rare near overview target)
```

## Fixed test plot (rule-picked, seed 684)

Peak density cell from probe: **≈ (−129, −181)**, dens ≈ 0.45 (wet-shore band).
Dwelling drink / watching stone is the presentation near camera (Corner → Look at it / Its water).
Overview Orbit target default **(−20, 10, 0)** — often **open / low dens**, so panel shows few near blades even when island cover field is large.

## Hypotheses (pre-fix)

| # | Claim | Status |
|---|---|---|
| H1 | Per-blade dens RNG empties clumps | **Confirmed** (25≈27) |
| H2 | Overview focus not in high dens | **Confirmed** (stats disc = target) |
| H3 | No soil underlayer → grass “stuck in porcelain” | **Confirmed** (shader has no near under-moss) |
| H4 | Flowers exist only near peak dens, not near drink/overview | **Likely** (probe at peak had 2 clumps; panel at overview had 0) |
| H5 | Stele+slab geometry/material read as placeholder | **Confirmed** (screenshots) |
| H6 | Scale uses Penglai boulder/island targets | **Confirmed** (`SCALE_TARGET`) |

## Fix intent (this pass)

1. Patch hierarchy: suitability → patch mask → clumps with full blade sets (no per-blade dens kill).
2. Stronger shared far/mid ground tint as soil/moss transition (not circular stickers).
3. Island-wide flower anchors for Look-at; denser flowers inside patches.
4. Stele + lower stone base redesign; Wonderland scale rows/targets.
5. Browser verify if possible; else mark visual-unverified.

## After fix (probe + Playwright)

| Metric | Before (owner shot / probe) | After (probe 684) |
|---|---|---|
| blades / clump | ~0.9 (25 / 27) | **~7.7–8.1** |
| Overview near blades | 25 | ~418 |
| Drink near blades | (sparse needles) | ~833 |
| Flowers @ drink disc | 0 | **1 clump / 4 heads** (dens-peak guarantee) |
| Flower anchors island | n/a | **10** |
| Stele scale label | 巨石 vs Penglai 2–12 ↓ | `stele` / Wonderland targets |
| Browser | owner screenshots | `scripts/out/qa-*.png` (Playwright); headless FPS 2–4 **ignored** |

Commands (updated paths): `npx tsx scripts/probe-cover-habitats.ts`; `node scripts/qa-screenshots.mjs`.

## Habitat differentiation pass (same day, later)

See `habitat-differentiation-2026-10-26.md`. Density units clarified (`clumpsPerM2×dens`); camera dens-peak flower invent **removed**; live zone surfaces in normal view; open-stone suitAt gate → 0 blades in open plot. Sample plots in `scripts/out/habitat-plots-684.json`.
