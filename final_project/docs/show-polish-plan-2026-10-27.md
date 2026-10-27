# Show polish — plan (2026-10-27)

**Goal:** Stable, natural, presentation-ready island. No caves / buildings / new species / multi-creature.

## Order

1. Shore / surface hard-edge **diagnosis** → targeted fix (geometry / normals / LOD / material / water junction — not blanket blur).
2. Habitat richness (wet shore continuous sheets, woodland edge litter+grass, open grass islands) — structure over blade count; 留白 kept as white-stone *language*, not as a stop on richness.
3. Grass wind: keep field, tame gust spikes; root-stable, tip motion; frame-rate independent.
4. UI: Layout → Advanced; hide nav diag from common Debug; short Walk hints; Dwelling default 10× (sim speed); scale anchors for terrace group + main range; Walk dwelling stays live.

## Must-read

| File | Why |
|---|---|
| `water.ts` | Bed carve, bank slope, sheet under-bank, mask blur |
| `flowWater.ts` | GROUND soft shore alpha / discard |
| `cdlod.ts` | Water paint far, cover tint, steep-bank LOD, morph |
| `cover.ts` / `CoverGrass.tsx` | suit/patch/density niches |
| `atmosphere.ts` `windAt` | gust / flutter |
| `Scene.tsx` / `ScaleView.tsx` / `strings.ts` | menus, scale, dwell |
| `frame.ts` | Layout turn / variation |
| `scripts/probe-shore-edges.ts` | Attribution metrics (mask / bank / sheet / surface) |
| `scripts/probe-cover-habitats.ts` | Patch area / connectivity before–after |

## Shore diagnosis (dev-only, no menu)

Run `npx tsx scripts/probe-shore-edges.ts [seed]` for quantitative hints. Visually (same seed 684 + fixed camera): (A) flat terrain albedo; (B) cover/wet off; (C) fine LOD; (D) normals/morph/water junction. Attribute before fix — allow multiple causes.

| If… | Then… |
|---|---|
| Contour polyline / stair sheet edges | Geometry or water mesh sampling |
| Lit triangles on bank | Normals + CDLOD relief split |
| Far water colour blocks | Mask / light.b softstep |
| Material square edges | Surface blend weights |
| Hard water–land junction | Depth fade in `flowWater` GROUND |

Do **not** metre-scale blur the whole shore or blanket-blur albedo to hide facets.

## Landscape richness

Adjust suit / patch / connectivity in `cover.ts` (wet sheets, wood edge, open islands). Prefer patch area over `clumpsPerM2`. Mid carpet albedo may strengthen reading; mid impostors only if mid still flat after that — small trial, not infinite near-blade distance.

## Wind

Separate base field / gust / flutter in `windAt`. Soft gust envelope; tip-weighted (already `t*t` in grass). Report before/after coefficients.

## UI (decided — execute)

- Layout → `高级生成参数` / Advanced generation (collapsed).
- Nav diag → Dev folder (not common Debug).
- Walk hints: unlocked / locked / return-orbit line.
- Dwelling default **10×**, labelled sim speed; no auto-reset on mode switch.
- Scale: terrace group + range massif group boxes; category toggles.
- Dwelling stays live in Walk.

## Acceptance

Seed **684** + two other known seeds. Overview / mid / Walk eye. Report format in owner brief. Sync handoff / world-plan / presentation-notes after.

## Docs after

`show-polish-2026-10-27.md`, handoff, world-plan, presentation-notes.
