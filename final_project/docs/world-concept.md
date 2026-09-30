# Guixu 归墟

## One Line

Five mountains float above an endless sea of clouds, drifting with
the currents. Wherever they drift, the climate, the plants, and the
creatures change with them. All water and all light eventually flow
toward the bottomless valley at the center.

## Why "Guixu"

歸 gui means "to return"; 墟 xu means "ruin," also "void" or
"empty place." Together: the place to which all things return.

In the source text it is a bottomless valley east of the Bohai Sea.
All the waters of the world, and the River of Heaven itself, pour
into it, yet it neither increases nor decreases.

The word works on three levels at once: it is a location (the
whirlpool at the center of the map), a mechanism (where all water
and wind converge in the simulation), and a theme (everything
returns).

## Sources

### Structure: Liezi, "The Questions of Tang"

Liezi is a classical Chinese Daoist text, traditionally attributed
to Lie Yukou of the Warring States period. The received text has
eight chapters. Most scholars hold that it was compiled or expanded
during the Wei-Jin period rather than surviving intact from the
Warring States; its authenticity has long been debated.

"The Questions of Tang" (汤问) is structured as a dialogue about
the limits of the world and the scale of things. Several of the
best-known Chinese myths come from this chapter.

The five mountains appear here: east of the Bohai Sea lies a
bottomless valley named Guixu. Above it float five mountains:
Daiyu, Yuanjiao, Fanghu, Yingzhou, and Penglai. Their roots are not
attached to the seabed, so they drift endlessly with the tides.
The Emperor of Heaven ordered fifteen giant sea turtles to hold
them up on their heads, working in three shifts rotating every
sixty thousand years, and only then did the mountains stand still.
Later a giant from the land of Longbo hooked six of the turtles in
a single cast, and Daiyu and Yuanjiao drifted to the north pole
and sank into the sea.

Reference:
- https://en.wikipedia.org/wiki/Liezi
- https://ctext.org/liezi/tang-wen

### Content: Shanhaijing, "Classic of the Mountains"

What exists on each mountain is generated following the entry
format of the Shanhaijing (Classic of Mountains and Seas). The
original entries are highly regular in structure: a mountain is
named; what is abundant on its upper and lower slopes is listed;
then a plant, a tree, a beast, each described as "shaped like A but
with B"; then its effect when eaten or worn; then the river that
rises there and where it flows.

This format is already a data structure.

Reference:
- https://en.wikipedia.org/wiki/Classic_of_Mountains_and_Seas
- https://ctext.org/shan-hai-jing

### Visual: Blue-green landscape painting and Dunhuang murals

Color comes from the mineral pigments of Chinese blue-green
landscape painting (azurite, malachite, ochre) and from the faded
mineral palette of the Dunhuang cave murals.

Forms are simplified and read by silhouette. Visual richness comes
from density, layering, light, and motion, not from detail on any
single object.

## Rules of the World

1. Everything is produced by the same generators; only the
   parameters differ. A mountain is not a model file, it is a set
   of numbers.
2. The islands drift. Position determines climate, climate
   determines vegetation, vegetation determines creatures. This
   causal chain is the only engine the world has.
3. Everything flows toward Guixu: water, cloud, light, and
   eventually the mountains themselves.
4. Creatures are omens. When a creature appears, the world changes
   state, but what changes is light and season, not disaster.
5. Apart from sinking, nothing is lost irreversibly.

## Scale and Infinity

The world is infinite in content, finite in boundary, and the
boundary itself is a view.

- Content is computed from coordinates, not placed by hand. Nothing
  is pre-arranged; whatever is in front of the camera is generated
  on arrival.
- The islands drift. Position determines climate, so the same place
  is not the same place an hour later.
- The cloud sea between islands has no boundary.
- A plateau edge is not the end of the map. Standing at the cliff
  with nothing below but cloud is one of the intended views.

Three scales share one generator, sampled at different densities:

| Scale | What is seen |
|---|---|
| Chart | The five islands and the whirlpool from above, like an old map |
| Cruise | Low eye-level, the world drifting past |
| Close | A single plant, creature, or rock, which triggers an entry |

The island silhouette on the chart and the terrain walked in cruise
must come from the same height field. Hand modeling cannot
guarantee this; procedural generation gets it for free. This is the
strongest argument for why the project must be procedural.

## Five Regions

All five share one silhouette grammar (flat plateau, sheer cliffs,
hanging base, waterfalls into cloud), one lighting model, and one
base palette of warm grey stone and deep green vegetation.

They differ in landform type, vegetation, water, time of day, and
accent hue. Walking the five in order gives a color and mood arc:
gold, rice gold, turquoise, ochre, deep blue.

| Mountain | Landform reference | Source material | Time of day | Accent | Key visual |
|---|---|---|---|---|---|
| Penglai 蓬莱 | Huangshan granite | Mount Zhaoyao; the herb Zhuyu, the tree Migu | Early morning, heavy mist | Dawn gold | Sea of clouds, gnarled flat-topped pines, bare granite |
| Yingzhou 瀛洲 | Yuanyang rice terraces | The Fertile Wilds; grain grows unsown | Sunrise | Rice gold | Hundreds of flooded terraces mirroring the sky |
| Fanghu 方壶 | Jiuzhaigou travertine pools | The Wilds of Zhuyao; phoenixes sing and dance unbidden | Dusk | Peacock blue | Turquoise pools, tiered falls, highest saturation |
| Yuanjiao 员峤 | Zhangye Danxia banded rock | Half-sunken, abandoned | Overcast, no direct sun | Ochre red | Horizontal red strata, no vegetation, wind erosion |
| Daiyu 岱舆 | Limestone caves, underground rivers | Fully sunken into Guixu | Underwater, one shaft from above | Faint cold blue | Stalactites, glowing mineral veins, dark water |

Each island's full setting is written separately under
`docs/islands/`. Penglai is complete: [islands/penglai.md](islands/penglai.md).

Note: Daiyu is the one exception to the warm-accent rule. It has no
warm light source; its accent is the cold glow of mineral veins.

Each island differs by generation RULE, not only by seed:

| Mountain | What changes in the generator |
|---|---|
| Penglai | Stone peaks on a meadow plateau, blunt hanging rocks below, thin falls and rock pools, height-and-slope surface classification |
| Yingzhou | terraceSteps pushed very high, each step filled with water |
| Fanghu | Multiple carved basins, strong water reflection |
| Yuanjiao | Color banded directly by height, vegetation density zero |
| Daiyu | Density field inverted into caves (requires voxels, not a height field) |

## What the Visitor Does

Wander and observe. No combat, no building, no quests, no
collecting. The only interaction is proximity: approaching startles
birds, opens or closes plants, and leaves a brief trace of light
on the ground.

## How This Differs from Existing Shanhaijing Projects

Most existing digital projects organize and display what is already
in the text: bestiaries, maps, databases. This project does not
organize. It lets the rules keep growing, generating mountains,
plants, and creatures that are not in the original, and writing
entries for them in the original's format.

The Shanhaijing was itself written from illustrations that have
long been lost. This project works in the opposite direction: from
text and rules, it regenerates the missing picture.

## Design Rules

### Style

Stylized painterly 3D: simplified forms under naturalistic,
physically plausible lighting. Reference point is the work of
thatgamecompany (Sky, Journey), not ink-wash painting.

The two source traditions are used at different layers, and this
separation is deliberate:
- Chinese blue-green landscape painting and Dunhuang murals supply
  the HUES: azurite, malachite, ochre, iron red. These are object
  colors.
- Contemporary stylized 3D supplies the LIGHT: warm key and cool
  shadow, volumetric haze, bloom, saturation falling off with
  distance.

Pigment from the paintings, light from the games. The world should
never look like a flat painting.

### Color

- Rock is rock-colored: warm grey and pale ochre. Azurite and
  malachite appear as accents in shadowed crevices, along plateau
  rims, and where vegetation clings. Never a uniformly turquoise
  cliff.
- Vegetation is the darkest value in the frame: deep pine green.
- Richness comes from warm and cool separation, not from adding
  hues. A lit face and a shadowed face of the same rock are two
  different color temperatures.
- The sky is a three-stop gradient (horizon, mid, zenith) and is
  the largest source of color in any frame.
- Saturation falls off with distance. Foreground may be vivid;
  the far distance must be pale.
- High-saturation color arrives as dense small elements (flowers,
  motes, birds), which may occupy one or two tenths of the
  foreground.
- Each region is limited to four or five pigments; layering comes
  from value, not from more hues.
- Avoid pink and magenta skies; prefer teal and gold.

### Light

- Low key light, generally behind the subject; rim light on
  everything.
- Volumetric god rays where the composition allows.
- Cast shadows are required. Without them the image reads flat.
- Light color shifts with time of day; this is the clearest
  evidence that the world is running.
- Bloom is required.

### Form

- Landform grammar, shared by every island: a broad flat plateau
  on top, sheer vertical cliff walls, an irregular narrowing rock
  base hanging into cloud, thin waterfalls falling into cloud.
- The plateau must be wide and walkable. Islands are not thin
  spires.
- Silhouettes read at a distance; detail lives in quantity, not in
  single objects.
- Landform references are Chinese: Huangshan, Zhangjiajie, Guilin
  karst. Explicitly not natural stone arches, mesas, or canyons of
  the American southwest.
- Architecture, where it appears, is small: wooden pavilions with
  upturned eaves, stone stairs, cliff walkways. Never castles,
  columns, or European ruins.

### Density

- Foreground: high density (grass, flowers, motes of light)
- Middle ground: medium density (trees, rocks, creatures)
- Background: silhouette and fog only
- Cloud masses should be large and soft, not fussy and fragmented.
  Fragmented detail is what makes an image look machine-generated.

### Motion

- Something is always moving somewhere in the frame.
- All motion shares one wind field, so the world reads as a single
  breathing system.

### Fog and cloud

- Depth comes from the cloud sea and the palette: a sea of cloud
  below every island, warm gold where it catches the light and soft
  lavender in its troughs, and saturation falling off with distance.
- A general height fog was tried in the first island study and
  removed: over a backlit island it turned everything a dusty grey.
  Mist returns where it has a reason to be, in low gullies and in the
  vapour at the foot of the falls.

## How the World Is Built

- Every landform is a height field, not voxels: each point on the
  ground stores one height, and the underside of an island is a
  second height field hung downward, stitched to the top at the rim.
  This is cheap enough to regenerate while a slider moves, and it
  suits plateaus, cliffs and hanging rock. It cannot make caves or
  overhangs; Daiyu, the cave island, will need a density field
  (voxels) instead.
- Themes: three palettes are kept for now. Blue-green (the default:
  azure sky, spring-green meadow, warm ochre stone), glazed tile
  (lapis sky, emerald meadow, white-jade stone, a snowy feel), and
  the depths of Guixu (cold teal, for the sunken regions). The
  per-island accent hues in the table above are still the target
  for when each island is built.