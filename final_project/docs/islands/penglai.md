# Penglai 蓬莱

## Overall

Penglai is the highest, driest, and most open of the five islands,
and the first the visitor arrives at, so its job is to establish
the world's first impression. A broad plateau hangs above the sea
of clouds. On it stands one tall main peak and several shorter
stone peaks. Between them lie meadows, bare pale granite and a few
small rock pools. Below the cliffs the island hangs down as one mass
that splits into a few large, blunt rocks. Rainwater falls from the
plateau edge as a few thin white threads that break into vapour
halfway down. The landform reference is Huangshan.

## Form

The plateau is not a flat slab. Roughly four tenths of it is gentle
meadow over thin soil, covered in low grass and small white
flowers, open and walkable. Three tenths is sloping bare granite,
pale grey, cut by visible vertical joint lines, with pines rooted
in the cracks. Two tenths is the base of the spire cluster, steep
stone columns standing close together with narrow passable gaps
between them. The remaining tenth is sunken gullies where cloud
pours in, rises, and drains away again.

These zones are computed, not painted. Which surface type a point
belongs to is decided by its height and its slope together: gentle
slope becomes meadow, steeper becomes bare rock, and the steepest
faces hold nothing at all.

## The Peaks

The first version made the peaks flat-topped columns; they read as
wooden stakes. The peaks are now natural stone mountains: a rounded
summit, steep upper flanks cut by ridges and gullies, and a foot
that spreads out into the plateau. Where two peaks stand close they
share a saddle instead of meeting at a crease. The main peak stands
off centre; four to six shorter peaks of clearly different heights
scatter around it, in a tight cluster that leaves open meadow, or
spread out toward the rim. Gnarled pines on the summits and in the
cracks are still to come.

## The Underside

Below the rim a near-vertical cliff drops and curls inward, and the
rock keeps deepening toward the centre. From it hang a few large,
blunt rocks at different depths, the deepest off centre, each
flaring at its root into the rock above. Between them are rounded
notches, never slots or cracks. The silhouette reads as one mass
breaking into several heavy stones, not a cone and not a stem.

## Water

Penglai holds less water than any other island, and this contrast
is deliberate. Its water takes three forms, none of which is a lake
or a river.

The first is cloud. At Huangshan the real water feature is cloud
moving through valleys rather than water moving across ground, so
mist gathers in Penglai's low gullies and disperses again. The
second is thin falls: rainwater drops straight off the plateau edge
as a few white threads that dissolve into vapour partway down. The
third is rock pools, a few small pockets of standing water in
hollows in the stone. They are small, but they are mirrors, holding
the sky and the pines: dark when seen from above, bright with sky
when seen at a low angle, lighter toward their shallow shores.

In the current build the thin falls start in the bays of the rim,
where water would gather, and the pools sit in the deepest hollows of
the plateau. The mist in the gullies is not built yet.

## Light and Color

The sun sits low behind the island, so the outline is always
backlit. The study defaults to midday under the blue-green palette:
a clear azure sky that stays blue down toward the horizon, a cloud
sea that is warm gold where it catches the light and soft lavender
in its troughs. Dawn, dusk and night are one drag of the sun away.

Rock is natural stone: warm ochre on top, lighter warm ochre on the
cliffs. Azurite and malachite appear only along the plateau rim and
faintly in shadow; never across a whole face. The meadow is the
darkest green in the frame. Three palettes are kept: blue-green
(the default), glazed tile (lapis sky, white-jade stone, a snowy
feel) and the depths of Guixu (cold teal, for sunken regions).

An early height fog was removed: it turned the island a dusty grey.
Depth now comes from the palette and the cloud sea; mist may return
later, in the gullies only.

## Experience

The visitor stands in meadow. The foreground is dense grass and
flowers, the middle ground a few pines and scattered boulders, the
background the silhouette of the main peak and an endless sea of
cloud. Walking toward the rim, the ground tilts, then ends at a
sheer drop with nothing below but cloud. That edge is not the end
of the map; it is the view most worth reaching.

## Source Material

Penglai draws on the opening entry of the Shanhaijing's Classic of
the Southern Mountains: Mount Zhaoyao, which overlooks the western
sea, abundant in cassia, gold and jade. It holds a herb named
Zhuyu, which stops hunger when eaten, and a tree named Migu, whose
flowers give light and which keeps the wearer from losing their
way.

These three become Penglai's first generated content: cassia as
the vegetation base, Zhuyu as small luminous grasses in the meadow,
and Migu as a tree in the rock cracks whose flowering leaves a
brief trace of light on the ground when approached.

## Generation Steps

Penglai is built in steps, each of which can be completed as a
separate technical experiment. Status in island-v1 is in brackets.

1. Base height field: Simplex noise layered into fbm and shaped
   into soft ridges, lifting a grid into gentle undulation. [done]
2. Peaks: seeded placement of one main peak and four to six shorter
   ones; each is a distance mask shaped by a power curve, with a
   ridged outline, joined by smooth union. [done]
3. Jointing: directional noise on the steep walls producing vertical
   fractures. [partly: ridged noise cuts vertical ridges into the
   cliffs and the hanging rocks]
4. Surface classification: height and slope together decide meadow,
   rock, or bare face, driving both color and vegetation. [done for
   color; vegetation not yet]
5. Mist gullies: carved depressions in the height field; cloud
   appears below a threshold height. [not yet]
6. Cliff and hanging rocks: a second, inverted height field; a
   vertical wall rolling inward, and a few blunt hanging rocks
   joined by smooth union. [done]
7. Thin falls: falling water threads from the bays of the rim,
   flowing in the shader. [done]
8. Rock pools: small bowls carved into the deepest hollows of the
   plateau, holding mirrors of the sky. [done]
