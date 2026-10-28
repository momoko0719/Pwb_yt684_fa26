# Guixu 归墟

![White Jade Island](public/atlas-img/white-jade-island.png)

Final project for Cornell Tech DESIGN 6197 Procedural World Building. Five floating mountains over the abyss of Guixu. The island in progress is **White Jade Island**.

Live: [White Jade Island](https://guixu-yt684.web.app/#/atlas/wonderland-terrain) · [Atlas](https://guixu-yt684.web.app/#/atlas)

## Open

| | What you see | Open |
| --- | --- | --- |
| **White Jade Island** | Porcelain ground, terrace, streams, a creature and its shelter | [Live](https://guixu-yt684.web.app/#/atlas/wonderland-terrain) |
| **Penglai Island** | Pines, wind, the 24 solar terms, paths and pavilions | [Live](https://guixu-yt684.web.app/#/atlas/island-v1) |
| **Atlas** | Both islands and the class cards | [Live](https://guixu-yt684.web.app/#/atlas) |

| Penglai | A day at the shelter |
| --- | --- |
| [![Penglai Island](public/atlas-img/penglai-island-v1-b.jpg)](https://guixu-yt684.web.app/#/atlas/island-v1) | [![Enter, lie, leave](docs/rock-shelter-684/slab-enter-lie-leave.gif)](docs/rock-shelter-slab-2026-10-28.md) |

Premise: [`docs/world-concept.md`](docs/world-concept.md). Shelter record: [`docs/rock-shelter-slab-2026-10-28.md`](docs/rock-shelter-slab-2026-10-28.md).

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
