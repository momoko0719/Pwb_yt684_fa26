# Guixu 归墟

Final project for Cornell Tech DESIGN 6197 Procedural World Building: a procedurally generated Chinese mythological world of five floating mountains drifting on a sea of cloud above the abyss of Guixu.

Live: [https://guixu-yt684.web.app](https://guixu-yt684.web.app). The world's premise and rules are in [`docs/world-concept.md`](docs/world-concept.md).

## What is built (midterm, Oct 14)

- **Atlas**: the class exercises 03–07, each reworked around Guixu and opened inside the site.
- **Penglai Island v1** (`src/experiments/island-v1/`), everything from one seed except the paths the visitor draws:
  - terrain: Simplex → fBm → ridged shaping → heightmap; peaks by distance masks and smooth union; an upside-down heightmap for the cliff and hanging rocks;
  - surface: slope and height masks for meadow, rock and cliff; rock pools; thin falls;
  - life: instanced grass and Zhuyu flowers; Huangshan pines from an L-system with three levels of detail;
  - wind: a vector field around the peaks, read by every shader;
  - time: the 24 solar terms (growth, autumn gold, snow, flowering, sun height) and the hour of day;
  - paths and pavilions: A* routes between two clicked points, stone arches over pools and gullies, pavilions from a shape grammar at ends worth one.

  The techniques panel in the page explains each one (what, where, how, which class). Every change and its measurements are logged in [`src/experiments/island-v1/notes.md`](src/experiments/island-v1/notes.md).

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run atlas    # build the class exercise apps into public/atlas/ (served as /atlas/classXX/)
```

The Atlas page lists the class exercises from `src/experiments/external.json` (text, picture in `public/atlas-img/`, link). The apps themselves are built from `class_03` to `class_07` by `scripts/build-atlas.mjs`; the output is git-ignored, so run `npm run atlas` again whenever a class app changes, and always before deploying.

## Deploy (Firebase Hosting)

```bash
npm run atlas
npm run build
npx firebase-tools login
npx firebase-tools use --add     # first time only: pick the Firebase project
npx firebase-tools deploy --only hosting
```

Routing uses `HashRouter`, so no rewrite rules are needed.

## Layout

```
src/
  core/          pure generation logic, no React
    rng.ts         createRng(seed): the only source of randomness
    noise.ts       simplex, fbm, domainWarp (seeded)
    palette.ts     palette.world (getPalette) and palette.ui: the only place colors live
    params/        parameter types and defaults
    generators/    params in, BufferGeometry (or 2D technique maps) out
    presets/       JSON parameter sets (a mountain is a JSON file, not a model)
    shaders/       shared sky / fog / rim-light materials
  leva/          custom leva inputs: sun arc, theme swatches, curve preview
  i18n/          LanguageContext + strings dictionary (en, zh)
  content/       ideas.{en,zh}.md; ideas/ holds the concept art and mood board (references, not world content)
  experiments/   one folder per experiment + registry.ts + external.json
  world/         the future full world (empty for now)
  pages/         Home, Ideas, Atlas, ExperimentPage, World
```

## Rules

- All randomness goes through `core/rng.ts`. Never `Math.random()`.
- `core/generators` are pure: no React, no leva, no global state.
- All colors come from `core/palette.ts`. CSS reads them as variables set in `main.tsx`.
- All user-visible text comes from `i18n/strings.ts`, including leva labels. Leva folder names stay English because they are the parameter paths.
- Parameter panels use leva. Controls that need more than a slider are leva plugins in `src/leva/`.
- An experiment's `meta.json` may list a `techniqueMap`; its text lives in `strings.ts` under `tech.<id>.*`.

## Adding an experiment

1. Create `src/experiments/<id>/` with `meta.json`, `Scene.tsx` (default export), and `notes.md`.
2. `meta.json` fields: `id` (must match the folder), `kind` (`"world-study"` or `"class-exercise"`), `title: { en, zh }`, `session`, `techniques[]`, `date`, `status`, `summary: { en, zh }`.
3. The Atlas picks it up automatically and serves it at `#/atlas/<id>`.

External class exercises go in `src/experiments/external.json` with the same fields plus `url`.

## Saving a preset

In an experiment, press **Export › Copy preset JSON** in the leva panel. The JSON is copied to the clipboard and logged to the console; paste it into a new file under `src/core/presets/`.
