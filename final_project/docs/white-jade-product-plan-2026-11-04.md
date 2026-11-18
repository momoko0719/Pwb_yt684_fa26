# White Jade — product plan (2026-11-04)

Status: plan for the owner's confirmation; nothing built. Follows
`ui-and-precedents-research-2026-11-04.md`. Decisions so far (owner): layout **A + C** (exhibit mode,
chapters on a handscroll); one island, **White Jade (白玉岛)**; treat it as a work to be published
(a site, a product), in Chinese and English; keep the procedural theme legible: visitors should be
able to see *how* it is made, not only a finished picture.

## 1. What the work is

**One line.** A floating island of white stone, generated from rules; a creature settles on it, and
wherever it lives the stone slowly turns to jade. (一座由规则生成的白石浮岛；生灵在此栖居，它生活过的地方，石头慢慢成了玉。)

**What a visitor should leave with.** (1) It is beautiful and calm. (2) Nothing was placed by hand:
mountains, water, plants, the creature's home all follow from rules and a seed. (3) Time leaves
traces: the jade is a record of a life, not a texture.

**What we drop.** No new islands. Penglai and the class atlas stay online as an archive, not
developed. No fish, veins, buildings or weather this round.

## 2. Precedents for where the work goes (not only UI)

| Precedent | What it does | What we take |
|---|---|---|
| Red Blob Games, *mapgen4* and its articles; Bret Victor's explorable explanations | a procedural map you can paint, beside prose that shows each step as a small live figure | a **"how it grows" (生成之理)** layer: each rule as a short text plus a live view of its field |
| Oskar Stålberg's Townscaper talks (grid → constraints → shapes) | the generation is shown as layers peeled back | **peelable layers** over the island: frame, height, water, zones, folds, contact |
| *Townscaper*, *Tiny Glade* | a toy: few controls, each changes the world visibly at once | visitor controls are few and causal (seed, day, run), never a wall of sliders |
| *Dwarf Fortress* legends, generated chronicles | history written from simulation events | a **creature chronicle (生灵日志)**: one bilingual line per event, from the sim ("Day 3: first drank at the east shore") |
| *Journey*, *Sky* | an emotional arc; light and time as story; almost no UI | the chapters are a short arc: arrival → mountains → water → life → jade; time of day moves with it |
| *Alto's Odyssey* (Zen), *Proteus* | only the landscape; Proteus's sound comes from the place | a "landscape only" state; later, if time: sound from water and wind |
| *绘真·妙笔千山*, handscrolls, museum albums | a painting unrolled in sequence; captions beside the work | the handscroll timeline (C); labels set like museum captions; vertical Chinese titles |
| *Monument Valley*, *Gris* | few colours, chapter plates, colour arriving as progress | a strict palette; colour (jade, grey-green life) arrives where life is |
| *Black Myth: Wukong* | identity through one typeface | type is the identity; no ornament |

## 3. The site as a product

Pages (bilingual, same structure in both languages):

1. **Home (首页)**: the live island small and quiet, the title set vertically in Chinese with the
   English beside it, the one-line premise, one way in ("Enter the island / 入岛"). Penglai and the atlas
   linked at the foot as "earlier studies".
2. **The island (白玉岛)**: the exhibit (A + C), the main work. Section 4.
3. **How it grows (生成之理)**: a long scroll page: the steps of the generation, each with a sentence,
   a live mini-view (the field as a map) and the numbers that matter; ends with the creature and the
   contact rule. Doubles as the course documentation.
4. **Notes (札记)**: process, references, credits (the current Ideas page, rewritten), course context.
5. **Archive (旧作)**: Penglai and the class atlas, unchanged.

## 4. The island page (A + C)

- **Full-bleed island**, a thin transparent header (title seal, language, menu), no dark band.
- **Museum label (展签)**, top left: 白玉岛 / White Jade; seed; day; what the creature is doing; one line of
  the current chapter. Vertical Chinese title, English in italic serif.
- **Handscroll (卷)**, bottom: the chapters as points along a scroll line: 总览 Arrival · 山 Mountains ·
  水 Water · 生 Life · 玉 Jade. Choosing one eases the camera and changes the label's text. Below it, the
  day line (0 → 30): drag to run the creature's days and watch the jade come (the sim runs ahead on
  demand, as the checks do).
- **"How it is made" toggle (显理)** in each chapter: one sentence of the rule and an overlay of its
  field (mountains: fold weight; water: flow; life: zones and shrub patches; jade: contact map),
  styled as part of the work (thin lines, the palette), not as debug colours.
- **Seal button (印)**, top right: a small drawer with the visitor controls: seed (with "another island"),
  day / run, landscape-only, sound (later). Everything else in **studio mode** (a key), the full leva
  panel for the author.
- **Chronicle (日志)**, collapsible at the label: the creature's events, bilingual.

## 5. Visual system

**Colour** — a new set for White Jade (the current `SILK_UI` parchment and black came from Penglai).
Three directions shown in the session; recommended **1. 羊脂·月白**:

| Token | Value | Use |
|---|---|---|
| paper | #F6F3EC at ~85% | panels, label, drawer (over the view) |
| mist | #DDE6E1 | hover, tracks, the scroll line's ground |
| jade | #8FB3AA | active states, the chapter you are on, overlays' lines |
| ink | #2E3330 | text (a cool grey-black, not pure black) |
| ink-dim | #6E7A74 | secondary text, numbers |
| cinnabar | #B8452F | the seal only (title mark, the one primary action) |

Option 3 (墨玉, dark glass) is kept for a later night / mother-of-pearl mode. All in `palette.ts`
(`JADE_UI`), CSS variables in `index.css`.

**Type** — bilingual rules:
- Chinese: a serif (Noto Serif SC / 思源宋体) for titles and text; titles may be set vertically
  (`writing-mode: vertical-rl`); 0.05–0.2em tracking on titles; line height ~1.9.
- English: a serif with similar contrast (EB Garamond or Cormorant for display, Source Serif for
  text); italic for the English line under a Chinese title; sentence case; line height ~1.6.
- The two languages in separate lines, never mixed mid-line; numbers in tabular figures.
- Web fonts: Chinese faces are large; subset the characters the site uses, or fall back to system
  Songti. Decide after measuring load size.

**Form** — hairlines in jade or ink, no boxed buttons, one seal; motion slow and eased (the camera,
the scroll), nothing bouncy.

## 6. Three weeks

| Week | Build | Shows at the end |
|---|---|---|
| 1 (to Nov 11) | Visual system (tokens, type, header); island page shell: label, handscroll chapters with eased cameras, seal drawer, studio mode | the island page as an exhibit, in both languages |
| 2 (to Nov 18) | Procedural legibility: the "how it is made" overlays per chapter; the day line driving the sim; the chronicle | a visitor can see each rule and watch the jade grow |
| 3 (to Nov 25) | The "How it grows" page and Home; art pass (distance haze and planes, shrub light/shade, water bank edges); capture a video; docs | the published site; buffer to the Dec 2 review |

Cut first if late: sound, night mode, the chronicle's English polish, Home's live island (a still
instead).

## 7. To confirm before building

1. Colour direction 1 (or 2).
2. Fonts: Noto Serif SC + EB Garamond (one serif family each), or add 霞鹜文楷 for labels.
3. The five chapters and their names (总览 · 山 · 水 · 生 · 玉).
4. Site pages as in section 3; Penglai and the atlas moved to an archive.
5. The day line: the creature's days run ahead on demand (seconds of compute for 30 days).

## 8. Week 1, first pass (2026-11-07)

Owner's choices: colour 1 (羊脂·月白), fonts Noto Serif SC + EB Garamond, the five chapters, the five
pages; the mechanics deep research (generation and activity as play, game references) is the next
round, after the UI.

Built:
- `JADE_UI` in `palette.ts` → `--jade-*` CSS variables (`main.tsx`); fonts from Google Fonts in
  `index.html` (Noto Serif SC is served in character slices); site body and header in the jade palette
  (light, translucent, hairline), `--font-text` / `--font-zh`.
- Exhibit pages: `exhibit: true` in an experiment's `meta.json`; `pages/studio.ts` (context);
  `ExperimentPage.tsx` hides the leva panel and the caption on an exhibit until studio mode (the `
  key, or the drawer's last row).
- `wonderland-terrain/Exhibit.tsx`: `chapterViews` (each chapter's camera by rule: the frame's back
  and basin, the plunge pool, the creature's corner), `ChapterCamera` (2.4 s ease in and out),
  `ExhibitLabel` (vertical 白玉岛, italic English, seed / day / what the creature does, the chapter's
  line), `Handscroll` (five chapters on a scroll line between two rods), `SealDrawer` (another island,
  the creature lives on, time 1× / 10× / 30×, landscape only, studio). The drawer drives the leva
  values through `levaStore.setValueAtPath`, so the studio and the exhibit stay one state.
- Strings `exhibit.*` in both languages; styles `.exhibit-*` in `index.css`.

Checked in the page (1440 × 860, seed 684): the island stands clear with label, scroll and seal;
choosing Mountains flies the camera there; Chinese switches the header, label and scroll; the drawer
opens with its five rows; studio shows the panel and hides the seal, the ` key hides it again; Penglai
keeps its panel. `tsc` clean.

Open: the Mountains view is a little low (the terrace fills the foreground); at the overview the
scroll covers the island's front rim a little; Home, Ideas and World are only recoloured (their
layout is week 3); the day line on the handscroll is week 2.
