# UI and game precedents — research and proposal (2026-11-04)

Status: research only, nothing built. For the owner to choose a direction. Prompted by a teacher's
note: the UI does not match the world, it covers the view, and games could serve as precedents.
Scope decision proposed: with about three weeks left, focus on one island, **White Jade (白玉岛,
the Wonderland page)**, and its story 栖居成玉 (life settles, the stone turns jade).

## 1. The UI as it is

Measured on the White Jade page at 1440 × 860 (seed 684):

| Element | Where | Problem |
|---|---|---|
| Site header | top, full width, 52 px, near-black | a dark band over a pale, luminous world; the heaviest thing on screen |
| Caption ("← Back to Atlas", title) | top left, boxed buttons | fine in size; boxes read as web UI, not as part of the world |
| Leva panel | right, 300 × 785 px (21% of the width, full height) | covers the right fifth of the island; 38 controls in one list (view, debug, dev, seed, layout, range, terrace, water, underside, dwelling) mixing visitor, author and debug settings; leva's monospace labels and black button against the serif site |
| Stats panel, legends | top left / bottom left when on | developer readouts shown in the same voice as the work |

What already fits: the serif type (Songti / Noto Serif SC), the paper colour (`SILK_UI`), the
seal-red accent, the EN / 中 switch. The problem is less the look than the **audience**: one panel
serves the visitor, the author and the debugger at once, and it never leaves the view.

## 2. Precedents

Sourced where marked; the rest is general knowledge of the games, worth checking with screenshots.

**Getting the UI out of the way**
- *Sky: Children of the Light* (thatgamecompany): almost no UI on screen; menus appear only when
  you touch parts of the screen; the interface was blended into the game's look, at some cost to
  clarity (press and reviews). Light is both visual and thematic. → A view with nothing over it;
  controls appear on demand.
- *Alto's Odyssey*, Zen mode: no on-screen UI at all, so attention stays on the landscape (developer
  description). → An "only the island" view for the show.
- *Ghost of Tsushima*: the Guiding Wind replaces map markers so players look at the world, not the
  interface; the team admits this makes design harder, and the wind can lose contrast (interviews,
  accessibility review). → Point at things inside the world (a light, a ripple, the creature itself)
  rather than with HUD icons.
- *Townscaper* / *Tiny Glade*: "radically casual", toy-like builders with a deliberately slim set of
  tools; the UI recedes so the procedural result is the content (PC Gamer, 80.lv). → Few controls,
  each with a visible effect.
- *Journey*, *Proteus*, *Monument Valley* (general knowledge): no HUD (Journey's scarf carries state
  in the world); Proteus is a procedural island with no interface at all; Monument Valley titles its
  chapters like plates in a book. → Chapter names over menus.

**Chinese aesthetics in UI**
- *绘真·妙笔千山* (NetEase × the Palace Museum): a 3D 千里江山图; the team weakened the puzzles to put
  the painting style, music and story first (developer Q&A). Its UI specifics were not found in this
  search: check screenshots.
- *Black Myth: Wukong*: a custom calligraphic typeface (汉仪黑神话体, after Ouyang Xun's running
  script) used in the interface: identity through type, not ornament (Hanyi case study).
- Handscroll and album (册页) formats, museum labels and seals as the language of presentation:
  sequence by unrolling, a small caption beside the work, one red seal as the only strong accent.

**Art lessons for the island itself** (general knowledge)
- Depth by aerial perspective and layered haze (Alto, Sky, Monument Valley): the overview is evenly
  lit and evenly sharp; a little distance haze and a darker foreground would give it planes.
- Few colours, one accent (Monument Valley, Gris): white jade, celadon water, grey-green life; red
  only as a seal or the creature's mark.
- Life as the colour that arrives (Gris, Journey): fits 栖居成玉 — the island starts white and quiet;
  shrubs, trails and jade appear where the creature lives.

## 3. Three layout directions (lo-fi, shown in the session)

- **A. Exhibit mode (recommended)**: the island full bleed; a small museum label top left (title, seed,
  day, what the creature is doing); a chapter bar at the bottom (总览 · 山 · 水 · 生灵 · 近看) that moves
  the camera; one seal button opens a small drawer of 6–8 visitor controls. The full leva panel moves
  to a hidden studio mode (a key, e.g. `` ` ``), for the author and for showing the teacher the rules.
- **B. Seal rail + drawer**: a slim vertical rail of 4–5 seal icons at the left; each opens a narrow
  drawer over the view only while in use.
- **C. Handscroll timeline**: a bottom strip like an unrolled scroll; days 0 → 30 (and the chapters)
  are points on it; the jade grows as you scroll.

A and C combine well: chapters along the bottom are the handscroll.

## 4. Theme tokens (proposal)

- Colour: paper / 月白 for panels at ~85% opacity over the view (no dark header on the island page:
  a thin, transparent one), ink for text, 天青 / jade for active states, seal red only for the
  title seal and the one primary action. All in `palette.ts` (`SILK_UI` extended).
- Type: titles in a Chinese serif (Noto Serif SC / Source Han Serif); a warmer hand for labels if
  wanted (LXGW WenKai, open licence); numbers in a lining serif or a small sans, never leva's
  monospace in the visitor view.
- Form: hairline borders, no boxes around every button; a seal for the one button that opens things.

## 5. Narrowing to White Jade: a three-week outline

1. Week 1 (to Nov 11): exhibit mode (A) with chapters, theme tokens, studio mode for leva; the
   header made light on the island page. Penglai and the atlas stay reachable but are not developed.
2. Week 2 (to Nov 18): art pass from the precedents: distance haze and planes at the overview, the
   shrubs' light/shade, the water's bank edges, the jade's presentation in the 近看 chapter.
3. Week 3 (to Nov 25): the story in time (days on the handscroll, a short scripted tour), capture a
   video, documentation; buffer before the Dec 2 review.

## 6. To decide

1. Layout: A, B, C, or A + C.
2. Type: serif only, or serif titles + 霞鹜文楷 labels.
3. The site's other pages (Ideas, Atlas, Penglai): keep as they are, or restyle to match.
4. Which controls stay visible to visitors (proposal: chapters, day / time, creature run, shrubs on,
   language), the rest to studio mode.

## Sources

- [Sky: GDC Vault, Art of Sky](https://gdcvault.com/play/1026812/Art-of-Sky-Children-of) ·
  [whatnerd review](https://whatnerd.com/game-review-sky-children-of-the-light) ·
  [Apple, Behind the Design](https://developer.apple.com/news/?id=zm47it7t)
- [Alto's Zen Mode (loopinsight)](https://www.loopinsight.com/2016/06/02/altos-zen-mode/)
- [Ghost of Tsushima interview (Press Start)](https://press-start.com.au/features/2020/05/22/ghost-of-tsushima-interview-weapon-upgrades-crafting-length-waypoints-and-more/amp/) ·
  [accessibility review](https://caniplaythat.com/2020/07/29/ghost-of-tsushima-accessibility-review/)
- [Townscaper's "radically casual" design (PC Gamer)](https://pcgamer.com/townscapers-developer-on-how-its-radically-casual-design-is-inspiring-a-new-wave-of-low-stress-builders-to-adapt-the-blueprint) ·
  [Tiny Glade review (PC Gamer)](https://www.pcgamer.com/games/city-builder/tiny-glade-review) ·
  [Tiny Glade developers (80.lv)](https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games)
- [绘真·妙笔千山 developer Q&A (TapTap)](https://www.taptap.cn/moment/15201399352592731)
- [汉仪黑神话体 case (环球网)](https://m.huanqiu.com/article/4KRCCP24DFM)
