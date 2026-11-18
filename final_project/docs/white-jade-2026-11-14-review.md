# White Jade Island — 2026-11-14 review and next decisions

## What changed, and what still fails

| Owner feedback | Status | Evidence / red-team verdict |
| --- | --- | --- |
| Remove “饮水站和嘴的位置” | Done | Removed the visitor-facing row from `Exhibit.tsx`. Expanded [settings screenshot](current-pass-settings.png) and DOM text check show it absent. The underlying debug data remains developer-accessible. |
| Raise the creature's neck | Partly done | Generated rest neck rises at 1.10–1.18 rad; maximum neck length was reduced so all 1000 sampled slider combinations stay under the 2 m crown envelope. [Model panel](current-pass-creature.png) and [live walk](current-pass-walk.png) show a more upright line. The shoulder still has a sharp wedge and the face/mane are not at the concept-art standard. |
| Make the shelter match the island and show procedural variation | Partly done | Replaced isolated brown-grey with pale stone tones from the island family and gave the seeded roof a low, faceted crown. [Live scene](current-pass-life.png); four-seed shelter probe passed. It still reads as a table-like constructed shelter. Do not call this art problem solved. Next sculpt pass should replace the exposed post-and-slab silhouette while preserving measured cavity/headroom and the current bed/route. |
| Cursor and clickable world resources | Partly done | New island cursor; hover switches to a card icon for vegetation/water and a paw icon for the creature. In-browser click opened **Jade Dweller**, **Pine**, and **Pool** cards. Shrubs are wired through the same pickable instancing path. Grass, flowers, boulders, and the shelter do not yet have world picking. The atlas already has generated preview samples and a “new sample” button; the creature's editor is still preview-only. |
| Zoom jitter | Partly done | `Ground` was lifting only the camera after OrbitControls' zoom. It now lifts the pivot by the same amount, preserving the viewing angle. Repeated near-grass assembly during a wheel gesture is deferred until 160 ms after the gesture settles. In the 90-wheel browser trace, cover assemblies dropped from 12 to 5, but headless p95 frame time remained ~73 ms (idle ~42 ms). A human visual pass on the owner's machine and GPU timing are still required. |
| Better relocation | Proposal below | Existing terrain double-click already changes Orbit focus but is undiscoverable. Recommend a compact clickable island map, not a draggable pegman, for the next review stage. |
| Water–jade relationship | Research and proposal below | No water/jade shader, water-system, or simulation changes have been made. Await owner choice. |
| Game precedents | Research below | Each cited work has a concrete mechanic and a possible adaptation, not only a visual mood reference. |

## Water and jade: factual boundary

Jade does not form because ordinary river water touches a rock for a few days. Geological jade formation involves deep-fluid metamorphism/metasomatism, while river transport can wear and round already formed jade, expose color, and concentrate durable fragments. GIA documents water-worn jade pebbles and fluvial abrasion; a Met jade landscape sculpture deliberately depicts a river in a carved jade world. These support **erosion/revelation** as a visual metaphor, not “water instantly makes jade.” [GIA: jadeite pebbles](https://my.gia.edu/gems-gemology/spring-2017-japanese-jadeite), [GIA: gemstone transport](https://my.gia.edu/gems-gemology/winter-2023-colored-stones-unearthed), [GIA: nephrite formation](https://www.gia.edu/gems-gemology/summer-2023-colored-stones-unearthed0), [Met jade landscape](https://www.metmuseum.org/art/collection/search/44218).

### Three candidate interactions — choose one before coding

1. **Water reveals jade (recommended).** The generated flow paths act as a mask: sustained contact rounds edges and gradually reveals a restrained celadon vein beneath pale stone. Strength depends on flow and contact duration; dry stone stays matte. Visitor can toggle a short “before / after water” view. This makes the water-system rule visible while respecting the geology metaphor. Start with one pool edge and one downstream bend, then decide whether to spread it island-wide. Do not use a uniformly glowing green border.
2. **Jade records life and water together.** Existing creature contact map and water proximity are separate causes. Their overlap produces a rare, more translucent-looking patch where the beast repeatedly drinks; routes alone leave subtler marks. Show both cause layers in the atlas. This builds on the existing `contact` data, but needs a visual design that avoids turning the shore into a debug heat map.
3. **Jade pebbles move downstream.** Seeded exposed jade flecks begin near the basin, appear as small rounded deposits at low-flow pockets, and stay reproducible by seed. This is physically legible and collectible in the atlas, but requires new transport/deposition logic and a larger performance budget. It is the most ambitious choice.

The recommended order is **1**, then a small piece of **2** if the effect reads clearly. Before implementation, obtain owner approval on the choice and a still frame showing the proposed color/area budget. No need to implement all three.

## Navigation decision

Extend the existing `WalkMinimap` into a visitor map for Orbit: real island outline and water, a current camera marker, and a click-to-focus destination. Clicking should preserve the current orbit angle and viewing distance, then move smoothly to the chosen ground point. This solves “back to Overview, zoom in again.” A draggable Google Maps pegman implies immediate first-person placement, which is a second interaction mode and a larger usability burden. It can come later as a clear “Walk here” action from the same map. Current terrain double-click can be mentioned in a short one-time hint after the map exists; do not add permanent explanatory text.

## Precedents to cite in the course presentation

| Work and primary source | Mechanic to study | White Jade adaptation / current gap |
| --- | --- | --- |
| [Townscaper](https://store.steampowered.com/app/1291340/Townscaper/) | A small click vocabulary produces contextual forms. | Make one water/contact choice change local stone form and finish immediately. Current settings expose rules, but visible cause-and-effect is weak. |
| [Mapgen4](https://github.com/redblobgames/mapgen4) | Rebuilds rivers and relief quickly as terrain is edited; source has explicit river/biome/render parameter groups. | Show one rule beside a live region and allow a small controlled intervention, rather than a wall of sliders. |
| [Cartographer](https://github.com/Jannchie/cartographer) | One seed determines tectonics, erosion, drainage, settlements; selecting a town opens a generated close view. | A clicked island element should open its generation story and a concrete local view. Current atlas clicks are only the first step. |
| [Equilinox](https://store.steampowered.com/app/853550/Equilinox/) | Species have environmental needs and lifecycles; the player changes habitat and observes the effect. | Relate the beast's dry home, walkable route, and safe drinking station to a visible habitat choice. Current simulation has the rule, but the visitor cannot yet experiment with it. |
| [threejs-procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals) | Seeded body variants, rigged movement and coverings are exposed as one procedural system. | Use as a technical precedent for seed-to-shape consistency and rig debug, not as a copied asset or automatic proof of our own art quality. |

Presentation framing: for each precedent, show **input → procedural rule → visible result → our adaptation**. A screenshot of a game without the mechanism will not establish precedent in the rubric sense.

## Verification and next review

- `tsc --noEmit` passed. `check-morph-rework.ts` passed all sampled forms. `check-world.ts` passed seeds 684, 5676, 7, 42. `check-dwelling.ts 684 4` and `probe-rock-shelter.ts 684,5676,7,42` passed. The water check still prints **12 pre-existing problems** despite exit code 0; this pass did not alter water.
- `git diff --check` reports trailing spaces already present in older handoff paragraphs; it does not report a source-code whitespace error in this pass.
- Page: actual 1440×900 screenshots of model, rest/life, walk, and Water; actual hover/click of creature, pine, and pool. Penglai was opened and visually unchanged; no browser errors.
- Red-team after pass: the beast's shoulder wedge, face and mane remain weak; the shelter still looks built rather than grown; cursor affordance misses small vegetation and rock; zoom still has unverified human-visible stutter; the water–jade causal visual is still a proposal. Do not move to fish/birds or claim final art before these are reviewed.
- Next review order: (1) owner decides water–jade direction; (2) sculpt a coherent shelter silhouette while preserving cavity and routes; (3) complete pickable grass/flower/stone cards and current-instance procedural explanations; (4) Orbit minimap prototype; (5) live zoom visual QA and GPU timing; (6) return to creature shoulder/face/mane surface quality. Preserve all existing uncommitted work.
