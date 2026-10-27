# Presentation notes — next show

Short demo: Penglai first, then Wonderland. Goal line: from generating a landscape to life
settling there and slowly shaping it (栖居成玉).

## Run

```
cd final_project
npx vite --port 5180 --strictPort
# or: npm run dev
```

Site uses HashRouter.

| Island | URL |
|---|---|
| Penglai | `http://localhost:5180/#/atlas/island-v1` |
| Wonderland | `http://localhost:5180/#/atlas/wonderland-terrain` |

Demo seed for Wonderland: **684** (Island → seed). Layout lives under **高级生成参数 /
Advanced generation** (collapsed). Variation default is **1** (seeded); set variation to **0**
only to match the agreed blockout proportions exactly.

## Suggested flow (Wonderland)

1. **Overview** — default camera (~600 m). Show the ring of peaks, terrace stair, falls, fan of
   streams, wet-shore grass sheets and open grass islands on white stone (留白 as language, not
   emptiness). Optional: View → Zones / Scale (group boxes for terrace + range).
2. **Rules / other seeds** — change Island → seed (e.g. 7, 42, 1234). Same structure, different
   lie. Advanced → variation 0 vs 1 if asked how much the seed may move the basin.
3. **Pick a creature** — Dwelling: Run on, **Sim speed 10×** (default; not walk m/s). Homes A/B/C.
4. **Camera buttons (Dwelling panel, in order)** —
   - Island overview → Its water (drink shore, ~160 m) → Look at it (corner) →
     Its home → Close to the ground (jade vs stone) → Island overview again.
5. Leave Run on so jade accumulates while talking. Walk keeps dwelling live.
6. **Walk** — unlocked: click to enter; locked: WASD · Shift · Esc. Turn Walk off to return to orbit.

Seed compare: Island → seed (7, 42, 1234…). Advanced → variation stays at 1 unless showing the
agreed blockout (0). Nav diagnostics: **Dev** folder only (not for the talk).

Penglai: one short orbit + techniques panel if time; do not rebuild Wonderland’s story there.

## What must be rule-driven (do not hand-place for the demo)

Creature home and drinking stand, routes, contact → jade, woodland sites, frame layout.
Fixed seed and camera presets for the talk are fine.

## Checks before the talk

From `final_project/`:

```
npx tsc --noEmit -p .
npx tsx scripts/check-world.ts
npx tsx scripts/check-dwelling.ts 684 30 0 scripts/out/dwell.png
# water baseline (record; do not retune thresholds to “go green”):
npx tsx scripts/check-water.ts
# agreed layout only:
# PowerShell: $env:VARIATION='0'; npx tsx scripts/check-water.ts
```

Diagnostic images: `scripts/out/` (gitignored). Do not leave PNGs in the repo root.

## On-screen cues

- Demo browse: Environment view **Normal**, Scale OFF, **Performance OFF**. View → **Grass** for amount.
- Env debug (exclusive): **Habitat zones** or **Grass density** (soft density heatmap — not raw suit).
- **Resources** opens the read-only atlas (sizes / locate); Close restores the island camera.
- Near shrubs: branch + sprays when close; mid/far keep mass and colour. Three tones (mostly grey-green).
- **Orbit** loads near grass on ground-ray focus (soft fade / hysteresis). Far tint + soil stay under near blades.
- Zoom stuck at 3 m with far subject? Keep scrolling in — pivot soft-reanchors (Dev → **Nav diagnostics**).
- Dwelling: Run / Speed / **Its home**（生灵＋卧痕＋角隅松）/ **Look at it** / Island overview. **Walk keeps the creature running**.
- Contact debug（默认关）：家、0.7 m 休息圈、饮水站、嘴目标、路线。
- **Walk**: spawns ~8 m from the creature’s home; minimap bottom-right. 3 m/s; Shift 5; Esc unlocks only.
- Docs: `wrap-grass-rim-flower-mountain-2026-10-27.md`, `grass-rim-drink-art-2026-10-27.md`, `rim-drink-atlas-shrub-2026-10-27.md`.
- Near grass: camera-foot retention + auto-assemble when stopped (no extra scroll). Look only prefetches.
- Mountains: warm white stone. Folds take a light grey-olive (`#A8C888`) by `mountain × 6m/18m fold × strength`. Not a height belt, not a painted face, not a foot ring. Toggle Advanced → Rock folds. Stone colour debug only shows fields; Final tint weight is the value the picture uses.
- Shrub patches lean ochre; stele hidden (no path block).

## Known limits to say aloud if asked

- One demo creature; moisture / hollow are proxies, not hydrology.
- Mid cover is still mainly ground colour, not mid-distance grass volume.
- Headless FPS is not a GPU measurement.
- Overview is for silhouette + far cover organisation, not counting near blades.
- Stream-bank triangle facets may still show at mid LOD (terrain, not cover) — eye-check with wireframe if a crack appears.
- Island rim: shared `RIM_JOIN` (top keep-band + densified flange); waterfall / LOD-freeze still to eye-check.
- Mountain morphology tint is form-driven; do not describe peak caps / waist belts / foot rings.
- Atlas creature card has Locate only (no stand-alone mesh); vegetation covers are real-model thumbs.

## Rock folds (2026-10-27)

Advanced → 山褶色 / Rock folds (on by default, strength 1). The slider is a linear mix, not a floor.
Stone colour debug → Final tint weight shows that same weight in fixed 0–1 grey. Compare with the
tint off at the overview and at a middle view of the inner wall. The older deep-olive replace is gone.

## Shrubs (2026-10-27)

View → 低灌丛 / Shrubs (on). Overview: organised grey-green masses (a few ochre / rare vermillion
patches). Middle woodland edge: pine → shrub → grass → white stone. Close: branch + leaf sprays,
not a mossy ball. Story: life settles first where soil and water gather; jade comes after.

## Resource atlas (2026-10-27)

View → Resources. Covers from real generators (cached). Detail: config vs sample vs **measured**
island size (one creature → one size, not a fake range). Preview camera keeps real proportions;
Locate for live instance. No-preview cards hide rotate / resample / person.

## Dwelling life (say aloud)

It rests at a fixed home (A/B/C), walks a dry path to a shore stand, drinks with muzzle on real
water, then returns to within ~0.7 m of the same home and lies down again. Jade builds where feet
and body actually touch. Homes do not jump when a path fails.
