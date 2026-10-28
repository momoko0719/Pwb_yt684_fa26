# Guixu

![Five mountains drift above the abyss](public/atlas-img/guixu-banner.jpg)

Final project for Cornell Tech DESIGN 6197 Procedural World Building. Five mountains float on a sea of cloud. Two of them are open.

| White Jade Island | Penglai Island |
| --- | --- |
| [![White Jade Island](public/atlas-img/white-jade-island.png)](https://guixu-yt684.web.app/#/atlas/wonderland-terrain) | [![Penglai Island](public/atlas-img/penglai-island-v1-b.jpg)](https://guixu-yt684.web.app/#/atlas/island-v1) |
| Porcelain ground, a terrace of pools, streams off the rim, and a creature whose days turn the stone it touches toward jade. [Live](https://guixu-yt684.web.app/#/atlas/wonderland-terrain) | Pines, wind, the 24 solar terms, paths and pavilions. [Live](https://guixu-yt684.web.app/#/atlas/island-v1) |

Both islands, and the class cards, open from the [Atlas](https://guixu-yt684.web.app/#/atlas). Premise: [`docs/world-concept.md`](docs/world-concept.md). Shelter record: [`docs/rock-shelter-slab-2026-10-28.md`](docs/rock-shelter-slab-2026-10-28.md).

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run atlas    # build the class exercise apps into public/atlas/
```

The Atlas lists class exercises from `src/experiments/external.json`. The apps themselves are built from `class_03` to `class_07` by `scripts/build-atlas.mjs`. That output is git-ignored, so run `npm run atlas` again before deploying.

## Deploy

```bash
npm run atlas
npm run build
npx firebase-tools login
npx firebase-tools use --add     # first time only
npx firebase-tools deploy --only hosting
```

Routing uses `HashRouter`, so no rewrite rules are needed.

## Where the code lives

```
src/
  core/          generation, no React (rng, noise, palette, generators)
  experiments/   one folder per island or study; meta.json is the Atlas card
  pages/         Ideas, Atlas, the experiment page, World
  i18n/          English and Chinese strings
```

White Jade Island is `src/experiments/wonderland-terrain/`. Penglai is `src/experiments/island-v1/`.
