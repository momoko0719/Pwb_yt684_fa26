# Scale

**1 world unit = 1 metre.** Every kind of thing in Guixu has a real-world size, and the sizes are
read against each other: a mountain, a pine, a pavilion and a 1.7 m person must keep believable
proportions. The numbers live in [`src/core/scale.ts`](../src/core/scale.ts):

- `SIZES`: the fixed sizes the generators use for things on the island (people, plants,
  buildings, paths, water). They do not scale with the island.
- `SCALE_TARGET`: what each kind of thing should measure, with its source, for checking.

Landforms (plateau, peaks, cliff, hanging rocks) are generated as fractions of the island's radius,
and the island's parameters are chosen to meet the targets.

## Why this exists

At the midterm (Oct 14) the professor's main criticism was scale. The island was a 62 m hilltop
with a 7 m "mountain", while the pines (up to 6.6 m) and pavilions (4–5.6 m) were life-size, so a
pine stood almost as tall as the main peak. The props were also sized "on a radius-31 island and
scaled with the radius", so making the island bigger made them bigger too, and the proportions
could never come right.

## Targets and sources

Every size is looked up, not guessed. Where no source was found, the row says so.

| Thing | Target | Source |
|---|---|---|
| Island | 800–1200 m across | **Design judgement.** One peak group cut from a Huangshan-like range (the Huangshan scenic area is 154 km²). |
| Main peak | 100–150 m above the plateau | Huangshan's centre is a remnant planation surface with domical peaks around it, local relief of hundreds of metres ([geomorphology paper](https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1096&context=geosciencefacpub)); the Lotus Peak summit path climbs about 110 m ([China News](https://www.chinanews.com/news/2004/2004-10-18/26/495727.shtml)). Tiandu Peak averages about 70°, up to 80°. |
| Spires | 0.4–0.7 of the main peak | as the generator sets them |
| Cliff + hanging rock | 200–400 m | Huangshan peaks rise about 1000 m above the surrounding ground ([UNESCO Global Geopark](http://www.globalgeopark.org/GeoparkMap/geoparks/China/12482.html)) |
| Thin falls | 3–9 m wide | Ren Zi Falls drops 80 m; Nine Dragon Falls drops 360 m over 600 m, its upper falls about 5 m wide, the last over 20 m ([Wikipedia](https://zh.wikipedia.org/zh-cn/%E4%B9%9D%E9%BE%99%E7%80%91)) |
| Lake | 100–200 m across, about 8 m deep | **Design judgement.** Huangshan has no lake this size; depth after the Emerald Pool (about 15 × 8 m, 10 m deep, [Ctrip listing](https://gs.ctrip.com/html5/you/sight/19/5599.html), unsourced) |
| Rock pools | 10–24 m across | the Emerald Pool, as above |
| Streams | 0.3–6 m wide | headwater streams are often about 0.3 m wide ([study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5807321/)); width grows with drainage area, the rate is a **design judgement** |
| Pine | 4–8 m on the cliff edge, 8–15 m on the plateau, 15–20 m in shelter | *Pinus hwangshanensis* grows 15–25 m in forest ([Wikipedia](https://en.wikipedia.org/wiki/Pinus_hwangshanensis), [Trees and Shrubs Online](https://www.treesandshrubsonline.org/articles/pinus/pinus-hwangshanensis/)); the Welcoming Pine is 10.02 m (Huangshan infographic) or 13 m ([NetEase](https://www.163.com/dy/article/D0POK6KJ0511B76H.html)). Wind-stunted cliff pines being shorter is a judgement; no figure was found. |
| Forest pines | 4–11 m, about 1100 per hectare of forest | natural Huangshan pine stands: 750/ha at 10.2 m mean height (1300 m altitude), 1514/ha at 3.7 m (1600 m) ([Acta Ecologica Sinica](https://www.ecologica.cn/html/2018/18/stxb201805071014.htm)); Huangshan's scenic area is 98.29% forest ([Guangming Daily](https://m.gmw.cn/2026-08/03/content_1304542111.htm)) |
| Rhododendron thickets | 1–3 m | **Design judgement**; the related *R. fortunei* reaches 4–5 m when old; Huangshan rhododendron grows at forest edges and on cliffs ([iPlant](https://www.iplant.cn/z/frps/29705)) |
| Boulders | 2–12 m | Flying-Over Rock: about 12 m tall, 7.5 m long ([Ctrip](https://you.ctrip.com/sight/huangshan120061/4406.html)) |
| Pavilion | 4.5–6.5 m to the finial, eave about 3 m, 3.2–4.8 m across | a Suzhou half-pavilion: eave 2.54 m, 3.3 m wide ([Gujian](https://www.gujian.vip/sys-nd/184.html)); the Ngong Ping pavilion is 5.4 m tall ([HK Tourism Commission](https://www.tourism.gov.hk/resources/english/paperreport_doc/press/2010-08-02/eng_annex_factsheet_of_ngong_ping_piazza.pdf)); single-storey eaves usually 3–4 m |
| Path | 1.5 m wide, steps 0.15–0.18 m | GB 51192-2016: paths at least 0.9 m, 1.2 m for wheelchairs, stair paths at least 1.5 m clear; outdoor steps 0.10–0.15 m ([standard](http://www.jianbiaoku.com/webarbs/book/269/2666188.shtml)); mountain steps run steeper |
| Grass | 5–30 cm (default about 15 cm) | alpine meadow-grass grows to about 20 cm ([reference](https://easyscape.com/species/Poa-alpina(Alpine-Meadow-Grass))) |
| Zhuyu flower | 20–50 cm | subalpine meadow flower stems 20–70 cm ([US National Park Service](https://www.nps.gov/mora/learn/nature/subalpine-wildflowers-white.htm)) |
| Person | 1.7 m, eye 1.6 m, walks 1.3 m/s | usual outdoor walking speed 1.31 m/s ([meta-analysis of 14k adults](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7806575/)); eye height about 0.93 of stature (common anthropometric ratio) |

The ratio that matters most: **main peak : pine ≈ 10 : 1** (120 m to an 8–15 m plateau pine).

## Measured

| Thing | Midterm (radius 31) | After the scale change (radius 500) |
|---|---|---|
| Island across | 69 m | 1116 m |
| Main peak | 7 m | 120 m |
| Spires | 3.1–4.4 m | 52–75 m |
| Cliff + hanging rock | 41 m | 369 m |
| Rock pools across | 4.7–7.5 m | 11–18 m |
| Thin falls | 4 m wide (scaled with the radius) | 3 m at the lip, 9 m frayed |
| Pines | 3.9–6.6 m (94% of the main peak) | 6.3–16.5 m (14%) |
| Path width | 1.2 m | 1.5 m |
| Grass | 0.17–0.4 m, over the whole island | 0.09–0.2 m, within 40 m of where you look |

## What changed in the code

- Props are sized in metres from `SIZES`; nothing multiplies by `radius / 31` any more (pines,
  pavilions, paths, pools, falls, grass, flowers, walking, camera clearance).
- The Penglai preset: radius 500 m, main peak 120 m, underside 260 m. Plateau relief is 3% of the
  radius (±15 m) instead of 6%, so the plateau rolls instead of turning into hills.
- Grass grows in a 40 m disc around the ground the camera looks at (dense within 12 m, thinning
  to the edge), on a fixed 2 m world grid so blades do not reshuffle as the disc moves; none when
  the camera is more than 250 m away.
- The camera: far plane 20 km, a near plane that follows the camera's height above the ground,
  zoom toward the cursor, and the sky and cloud sea scaled to the island.

## The scale view

In Penglai, the **Scale view** button (bottom left) turns on a survey of the island: a ground grid
and contour lines whose steps adapt to the island; a wireframe box with its height in metres around
every peak, pine and pavilion, measured from the meshes; two cinnabar 1.7 m figures; and a legend
with each kind of thing's size now and its target, both as a share of the main peak, sizes outside
the target in cinnabar, and a scale bar.

## Rules

- Before adding or resizing anything, look up its real size and cite the source; say so when a
  number is a design judgement. Then check its ratio to the main peak and to a person.
- Plants, buildings and people are sized in absolute metres. They do not scale with the island.

## Water and forest (after the scale change)

| Thing | Measured |
|---|---|
| Lake | 160 m across, 8 m deep |
| Streams | 26 streams, about 4 km in all, 0.6–2.6 m wide; 11 leave the rim |
| Forest | 54% of the island's top (dense on 51%), about 48,000 pines, 4.3–10 m |
| Open ground | 37%: meadow clearings, the bare upper peaks, the open rim |
| Rhododendron thickets | about 5,500, 1–3 m |
| Boulders | 119, 2–12 m, 16 over 8 m |

## Still rough (next steps)

- Paths route on a 96 × 96 grid (about 11 m cells): routes are coarse until the path step.
- The terrain mesh is 4–8 m per cell: faceted up close until the terrain detail step.
- The peaks are gentler than Huangshan's 70–80° walls.
