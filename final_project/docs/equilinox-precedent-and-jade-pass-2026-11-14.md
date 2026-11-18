# Equilinox precedent and White Jade Island pass — 2026-11-14

## Evidence from the developer and game images

This is a mechanism precedent, not just a visual reference. [ThinMatrix's official description](https://www.equilinox.com/about/) states that placed plants change fertility, animals have habitat needs and life cycles, and traits can be changed through breeding and modification. The [developer presskit](https://equilinox.com/presskit/sheet.php?p=equilinox) documents hunting, den building, honey making, ten biomes, and over 120 species. The [official gallery](https://equilinox.com/gallery/screenshots/) and [Steam screenshot showing the sheep panel](https://store.steampowered.com/app/853550/Equilinox/) show a selected species next to the living landscape, with General/Habitat/Abilities tabs. An [IndieDB UI devlog authored by ThinMatrix](https://www.indiedb.com/games/equilinox/news/ui-improvements1) explicitly discusses context-dependent cursor icons, names, hover cards, and highlighted new content. The [fish and UI devlog](https://www.youtube.com/watch?v=O5FDNFWfEOM) shows that UI and species were iterated together. These are the primary sources inspected; I did not play the game, so click timing and exact in-game behavior beyond the descriptions/screenshots are not first-hand observations.

| Equilinox input → rule → visible result | White Jade Island adaptation | Gap/red-team judgement |
| --- | --- | --- |
| Place plants → fertility/habitat changes → animals can thrive | Click a pine/shrub to show its generated wetness/slope/placement rule and the local terrain it affects | Currently the clicked card mostly lists size/count; the visitor cannot change a patch and see the beast react. Do not claim this loop exists yet. |
| Select an individual → view habitat and current state | Creature click opens the same atlas/editor; show actual rest, walk, drink, safe shore and the form sliders beside a live model | Preview is still separate from the island instance. Applying body changes to live locomotion needs shared collision/IK dimensions. |
| Modify a trait → descendants/appearance vary | One seeded skeleton, independent body depth, stature and horn topology/branches; birth form restorable | We have a form generator, not breeding or inheritance. Do not call it evolution. |
| Context cursor + card → can inspect a living object | Familiar pointer with small jade detail, pointer changes over pickable resources, a short action label appears | Grass, flowers and some stone are still not pickable. |
| Needs and effects remain visible in panel and world | A small field note should point to the real water path and contact patches, with a local before/after jade reveal | Current jade study is a two-site visual demonstration. It is not yet an editable water/ecology game loop. |

The course presentation should use one annotated Equilinox screenshot for **selection → panel → habitat rule**, and a second frame for **trait change → visible form**. Show our corresponding two frames beside them. Cite the developer blog and official description; credit Equilinox/ThinMatrix. Avoid copying its DP economy, large species tree, or crowded stat panel: White Jade Island's strongest theme is one place and one mythical species, with readable material causality.

## Stepwise red-team log

### 1. Research

- Before: Previous precedent note mentioned Equilinox in one row without inspecting its species panel, devlog, or the distinction between selection and evolution.
- After: Sources above give specific input/rule/result comparisons. Limitation: no local copy of the game was played; screenshots and developer description support only the behaviors stated in those sources.

### 2. Creature

- Before: Neck-to-chest line made a sharp wedge; one Build slider controlled body length and all thickness dimensions. Eyes and nostrils were near-identical dot geometry; there was no mouth line.
- After: Body depth is an independent generated axis and visible slider, seeded at birth. Rest neck rises more vertically, the torso front is shortened to meet the shoulder, and the neck root is blended. The two small high nostril slits and the lower curved mouth seam now have different positions, shapes and materials. The creature still uses the same skeleton and existing live pose solver.
- Red-team: First broad shoulder blend was rejected from the actual 1440×900 page: it produced a huge triangular neck. The blend was reduced. The independent depth slider changes the **atlas preview only**; the live island still instantiates the fixed birth form. That is a substantial interaction gap and needs shared rig/collision dimensions before claiming the island creature is editable. The concept art still has a richer face/mane than the current procedural mesh; this pass does not claim parity. [Current model view](art-direction-2026-11-09/creature-variation-2026-11-11/seed-684-paired.png).

### 3. Cursor

- Before: A large circle-plus and magnifying-glass variations were ambiguous, especially the paw icon which implied petting.
- After: Same familiar arrow shape in every state. Its tiny jade leaf marks the island theme; on pickable vegetation/water a field-note tile appears, and on the creature a quadruped mark appears. A localized short label states the action. Cursor assets are repo-native SVGs, so no sprite generation is needed.
- Red-team: Browser hover showed **Meet the creature** beside the living beast and an earlier direct click opened its card. A later automated click missed after screenshot delay because the beast had moved. Click coverage for all resource types, both languages and narrow viewport edges remains incomplete. [Actual hover](equilinox-pass-2026-11-14/creature-hover.png).

### 4. Water reveals jade — two-site study

- Before: Water paths and creature contact existed, but water did not visually expose jade. Previous proposal explicitly warned against a uniform glowing green border.
- After: The lower terrace's primary outlet lip supplies the pool site. A measured bend on the generated main waterway supplies the downstream site. The exposed lip/wall and downstream bank receive restricted celadon veins over about 30 seconds as a compressed time-lapse. The downstream terrain shader also requires the generated water-bank mask. Neither site uses a seed-specific coordinate. Existing water construction and beast life rules were not changed.
- Red-team: The first wall shader made vertical stripes, since horizontal world coordinates hardly change down that wall. The next iteration made repeated foam-like curls. Both were rejected after page captures; the latest pass attempts two sparse, slanting veins on the dry wall beside the spill. The final normal-strength screenshot still does **not** make these veins distinguishable from the existing fall/wall shading. A diagnostic eightfold uniform boost also did not make the desired mark legible. The downstream bend is likewise not visually established. This is **incomplete visual acceptance**, despite the generated site data and shader wiring. This is a visual metaphor for long-term exposure, not mineral formation physics or actual geological time. Flow-rate accumulation and a visitor before/after control remain absent. [Pool close-up](equilinox-pass-2026-11-14/pool-close.png) and [two-seed captures](equilinox-pass-2026-11-14/).

## Checks and next actions

`npx tsc --noEmit -p .` and `node scripts/run-ts-check.mjs scripts/check-morph-rework.ts` pass; the latter samples **3000** shape combinations and checks crown, drink reach and leg constraints. `check-world.ts 684,42` and `check-dwelling.ts 684 4` pass. `check-water.ts` exits 0 but prints **12 existing problems**; do not describe it as passing. The 1440×900 browser captures for 684/42 report no page errors. The Penglai page also rendered with no page errors after the shared material changes. Human art acceptance, GPU timing, sustained follow camera and all-resource cursor coverage remain unverified. Preserve existing uncommitted project changes. The next agent should read this file, `docs/white-jade-2026-11-14-review.md`, and `docs/wonderland-handoff.md`, then open `http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain` and compare the actual page with the linked captures.
