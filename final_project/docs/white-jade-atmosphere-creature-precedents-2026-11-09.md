# White Jade Island: atmosphere and creature direction (2026-11-09)

Status: design critique and production brief. No scene, water, shelter, or creature simulation rules changed in this pass.

## What the current image actually communicates

The overview frames the whole island, but the smooth sky meets the patterned cloud floor along a hard horizon. Cloud shapes repeat at similar scale, with little parallax or temporal change. Empty space is appropriate for a floating island; the problem is that the space reads as a static backdrop rather than air with depth. Adding several decorative birds to the present backdrop alone would not resolve that.

The creature has a meaningful behavioral system: it rests, follows a route, drinks, places feet, and writes contact that can change stone toward jade. Its rendered identity is much weaker. The current mesh is assembled from ellipsoids, cylinders, and cones: rounded torso, narrow neck, round head, tiny horns, straight lower legs, cone tail, and nearly uniform pale material. At the Life camera distance, the silhouette does not identify a particular animal; at atlas distance, the primitive junctions and lack of face, hooves, and secondary motion become obvious. “Mythic” is currently in the name and world rule more than the visible creature.

## Precedents and transformation

| Precedent and source | What is useful | Transformation for this island | Evidence to show in review |
| --- | --- | --- | --- |
| [Townscaper, official site](https://www.townscapergame.com/) | Small actions produce legible, rule-driven visual outcomes. | Footfall, drinking, and rest each leave distinct but restrained environmental responses; their placement comes from actual simulation contacts. Do not copy the building vocabulary. | Same seed, before/after contact and jade response, with the action visible. |
| [The Last Guardian, PlayStation developer interview](https://blog.es.playstation.com/2016/11/22/5-detalles-que-hacen-destacar-a-the-last-guardian/) | An extraordinary animal feels alive through head turns, attention, stretches, and adaptation to surroundings. | Add gaze, breathing, ear and tail responses to the existing rest/walk/drink states. Do not copy Trico's body or feathers. | Short fixed-camera clips in all three states, including transitions. |
| [Qilin object, The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search/51363) and [another qilin depiction](https://www.metmuseum.org/art/collection/search/69079) | Historical qilin imagery combines features of several animals; depictions vary, and supernatural quality can be signaled by form and surface. | Build a new island-specific animal: deer-like weight distribution and split hooves, a clear horn/antler crown, sculpted neck/shoulder transition, and a cloudlike tail. Use jade veining at contact points rather than literal historical flames. Do not label it an authentic reconstruction of a canonical qilin. | Silhouette sheets, material close-ups, reference-to-decision captions. |
| [Sky: Children of the Light, Apple Developer](https://developer.apple.com/news/?id=zm47it7t) and [Journey, thatgamecompany](https://thatgamecompany.com/journey/) | Broad atmospheric space can remain sparse while light, depth, and movement give it scale. | Preserve the clean sky palette and negative space; add a layered haze/cloud system and a few living cues at different depths. Do not fill the frame with props. | Same overview at two times of day, seed 684 and one other seed, short loop showing motion. |
| [Ghost of Tsushima, PlayStation Q&A](https://blog.playstation.com/2020/05/29/ghost-of-tsushima-your-questions-answered/) | Wind can connect landscape movement and navigation. | One slow wind direction may coordinate cloud drift, plant sway, and bird flight; it should be subtle and seeded. Do not import its UI or samurai imagery. | One camera view showing coordinated motion, not isolated looping sprites. |

These are design precedents, not a claim that the current project has implemented their lessons. For the final presentation, show each reference beside a specific transformed rule and a capture of that rule running. Attribute sources in credits.

## Recommended visual thesis

**A living jade island, not an ornamented diorama.** The white beast is a resident whose ordinary actions slowly disclose the island's supernatural geology. Its magic is visible through contact and material response. The sky has depth and weather rhythm without becoming crowded.

Recommended creature direction: a restrained, sculptural deer–qilin relative. Keep the torso compact enough for the existing rock shelter. Use a recognizable arched back and neck, larger readable head, one coherent horn crown, ears, tapered muzzle, split hooves, and a short shaped tail. Choose two or three dominant shape motifs (curved horn, flowing shoulder, split hoof); avoid stacking scales, feathers, mane, glowing eyes, and particles everywhere. At overview scale the creature can be small, but its atlas cover and Life camera must both read as the same designed animal.

The model needs authored surfaces rather than several intersecting primitives. Make three black silhouettes first (side and three-quarter views), choose one at the actual Life camera size, then produce a clean mesh and simple rig. Blender-to-glTF is a practical path for deliberate anatomy and UVs; preserve the simulation's body, hip, foot, and muzzle coordinates as animation targets. Keep contact/route logic unchanged. Test any body, horn, or tail growth against rock shelter clearance and drinking reach before integrating. A white porcelain base with restrained jade variation at hooves/horns and contact areas will read better than uniform white or full-body glow. Test the surface under morning, noon, dusk, and night lighting.

Behavior priorities: breathing and weight shift while resting; head and ear attention; natural head lowering and mouth-to-water contact; tail follow-through and leg motion during walking. The simulation should drive these cues. No separate canned animation should make the visible feet contradict planted foot data.

## Overview atmosphere: build in this order

1. **Depth before new creatures.** Soften the sky/cloud horizon with distance haze, give cloud layers different scale and speed, and remove obvious tiling. Keep the existing sky hue. Check that island contour, sidewall, and hanging underside remain legible.
2. **One shared environmental rhythm.** A seeded, slowly changing wind can move clouds and vegetation consistently. Light and cloud shadow should change together. Capture a short fixed-camera loop to see whether it reads as atmosphere rather than repeating texture.
3. **Sparse life with habitat logic.** Start with one to three distant bird silhouettes, or a small group, tied to ridge/shore/updraft regions and time of day. Give them a path and scale that make sense in perspective. They should not constantly cross the island focal point or fill the sky at all seeds.
4. **Fish only if the water supports them.** A few fish beneath a clear pool surface could respond to shade, depth, or the beast drinking. Make them part of the water ecology, not decals on top of water. The existing water checks have unresolved issues in prior notes; verify pool geometry and depth before spending on fish. Fish are a later experiment, not a prerequisite for a living overview.

Do not add every candidate at once. Compare the same camera/seed before and after each layer. If a layer does not improve depth, scale, or causal life, remove it.

## Production and review gates

| Stage | Deliverable | Pass condition |
| --- | --- | --- |
| A | Three silhouette sketches and reference board | Recognizable at Life camera size; horn, muzzle, torso, four legs, and tail remain distinct. |
| B | One authored creature mesh, atlas cover, and rig mapping | No obvious primitive intersections; feet and muzzle stay aligned to simulation; rest/drink/shelter probes pass. |
| C | Three behavioral clips | Rest, walk, drink each have readable pose and at least one secondary cue, without sliding or snapping. |
| D | Overview atmosphere before/after captures | Same seeds and camera; horizon and cloud depth improve without obscuring island or tanking frame time. |
| E | Optional birds, then optional fish | Movement is habitat-linked, sparse, and supports rather than competes with the island/creature. |

For each stage, save the reference URL, the design choice, a before/after image or short clip, what changed in the procedural rule, and what did not work. This directly addresses the course rubric's call for use and transformation of precedents, originality, aesthetic intent, research, and visual communication (`docs/course.md`).
