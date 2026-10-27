# Visible habitats — diagnosis & rules (2026-10-26)

Normal browse: Zones / Cover suitability / Scale **OFF**. Evidence: `scripts/out/cover-focus-684.json`, `habitat-plots-684.json`, `habitat-views-684.json`, `habitat-live-684.json`.

## A. Why a normal screenshot showed ~1 clump / 13 blades

**Not** “this place must be 留白”, and **not** disproved by island-wide `Cover cells>0` (≈10k).

| Fact | Data |
|---|---|
| Load centre | `CoverGrass` = **camera XZ + 18 m look-ahead** (`COVER_NEAR.lookAhead`), same rules everywhere (creature does not own a separate field) |
| Default overview | Camera `(-430,300,380)` → focus ≈ **(-417, 368)** = `ZONE.outside` → **0 clumps / 0 blades** in the 48 m disc |
| Wet representative | Focus `(-109,-21)` or look-button `(-111,-143)` → thousands of blades in disc |
| 1 clump / ~13 blades | One trial cell passed `suit`/`patch` gates with ~12 blades/clump — typical when the disc is almost all hard/open with a single niche, **or** when the camera grazes a thin edge of cover |

So the sparse screenshot was a **streaming / viewpoint** issue: the load disc was not over a representative habitat. Hand-placing grass for the demo lens was rejected; **Cover → Look at wet shore / woodland edge / stone grass island** jumps to rule-picked sites instead.

Files: `CoverGrass.tsx` (`useFrame` focus), `Scene.tsx` overview, `scripts/probe-cover-focus.ts`.

## B. Where grass grows (rules)

| Layer | Meaning |
|---|---|
| Zone label | Discrete; hard exclude **outside / water / cliff / ridge** |
| `suit` | Can support plants (moisture, slope, hollow, amount) |
| `patch` | Soft mask for vegetation sheets / islands |
| `density` | `suit × (0.12 + 0.88×patch)` — far tint + flowers |
| Near rate | **`clumpsPerM2` (2.0) × soft(patch) × soft(suit) × load-edge** — patch coverage ≠ interior density |

| Habitat | Suit / patch idea | Near result |
|---|---|---|
| Wet shore | Moist × distance-to-water × gentle slope; patch noise sheets | Continuous low grass; sparse to bare stone between patches |
| Woodland | Edge strong, heart quiet understory; litter from grove | Edge grass sheets + flowers; heart mostly litter |
| Open / habitat | Rare **low-freq moist islands** (boosted in hollows) | Small grass sheets on white stone — not absolute zero |
| Rock slope | Rare island × hollow × moisture; steep faces bare | Few toe islands |
| Terrace | Only wider dry seat away from water sheet / bund | Very sparse if any |
| Water / cliff / ridge | Hard off | None |

## C. Fixed sample plots (±12 m, seed 684)

Before (old rules): wet **0.24** clumps/patch m² · wood **0.39** · open **0**.

After (`habitat-plots-684.json`):

| Plot | Suit m² | Patch m² | Clumps / patch m² | Blades in plot | Flowers |
|---|---|---|---|---|---|
| wetShore (−111,−143) | 120 | 104 | **1.51** | 1881 | 1 |
| woodlandEdge (−119,29) | 244 | 236 | **1.51** | 4256 | 0 |
| openIsland (−159,−75) | 244 | 212 | **1.46** | 3693 | 1 |

Target test band 1–3 clumps/m² **inside patches** — met (~1.5). Not an island-wide average.

## D. Normal view (code vs visual)

| Habitat | Code | Visual check |
|---|---|---|
| Wet shore | Stronger wet stone + soil under real cover; denser grass sheets | Live Look-at: **~31k blades / 2594 clumps / 24 flower heads** in disc; build ~12.6 ms (`habitat-live-684.json`). IDE browser screenshot crop often misses the canvas — counts are authoritative here |
| Wood edge | Litter mix + edge density | Probe frames ready; same look button |
| Open stone | Large-scale weathering; moist grass islands | Plot blades 3693; island dens ~0.34 at pick |
| Still weak | Equal-width green ribbon avoided by design; some shores still thin if moisture low | Owner GPU beauty pass **未测** |

## E. Performance

| Item | Value | Kind |
|---|---|---|
| Full 5×5 chunk miss @ wet look | **12.6 ms** CPU assemble | **Measured** (browser stats) |
| Blade count in disc @ habitat look | ~25–31k | Measured |
| Chunk cache on small moves | only new chunks | Code |
| Owner GPU frame time | — | **未测** |

## F. How to view

1. `npx vite --port 5180` → `/#/atlas/wonderland-terrain`, seed **684**  
2. View: Zones / Cover suitability / Scale **OFF**  
3. Cover panel:  
   - **Look at wet shore**  
   - **Look at woodland edge**  
   - **Look at stone grass island**  
4. Frames: `habitat-views-684.json` / `habitat-plots-684.json` `cameraFrames`

Do **not** judge cover from Island overview alone — that camera streams sea (`outside`).

## Parameters (final this pass)

```
COVER_DEFAULTS.clumpsPerM2 = 2.0
COVER_DEFAULTS.patchFloor = 0.30
COVER_NEAR.clumpCell = 0.72
COVER_NEAR.suitFloor = 0.04
HARD_OFF = outside | water | cliff | ridge
```
