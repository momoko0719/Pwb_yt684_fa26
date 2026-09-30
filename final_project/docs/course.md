# Course reference: DESIGN 6197 Procedural World Building

Condensed from the syllabus the owner shared (Cornell Tech, fall 2026). Use it when planning
work or recommending next steps: every feature should serve the course's aims, map to a session
technique where possible, and move the project toward the midterm atlas and the final world.

## What the course asks for

- **Think procedurally.** Landscapes, cities and populations are systems authored through rules,
  constraints and emergent behavior, not things built by hand.
- **An atlas first, a world second.** The first half builds a portfolio of focused technical
  experiments (terrain, erosion, ecosystems, cities, populations, narrative); the second half
  synthesizes them into one complete, coherent synthetic world in the browser (Three.js).
- **A living world.** The final work is "a digital ecology or a persistent and ever-changing
  digital environment operating on the web", with its own geography, inhabitants, history and
  internal logic; it should show changes over time and emergent behavior, not an isolated demo.
- **AI-assisted, with attribution.** AI tools are required; the student stays author and critic,
  and documents how AI was used.

## Sessions (2026)

| Session | Date | Topic |
|---|---|---|
| 1 | Aug 26 | Intro, syllabus |
| 2 | Sep 2 | AI tools, context engineering, React + Three.js |
| 3 | Sep 9 | Procedural topography: maps; shaders |
| 4 | Sep 16 | Map simulations: erosion simulation, biomes |
| 5 | Sep 23 | Procedural topography: voxels |
| 6 | Sep 30 | Vector fields: simulated fluids, wind, atmosphere |
| 7 | Oct 7 | Procedural vegetation: L-systems, ecosystems (growth and distribution) |
| 8 | Oct 14 | **Midterm public exhibition**: the procedural atlas of experiments |
| 9 | Oct 21 | Procedural species: evolutionary solvers |
| 10 | Oct 28 | Agents and behavior: state machines and schedules |
| 11 | Nov 4 | Procedural cultures |
| 12–13 | Nov 11, 18 | Optimization and performance |
| — | Nov 25 | No class |
| 14 | Dec 2 | **Final review public exhibition** |
| — | Dec 18 | **Final deliverables due** |

Note on numbering: the repo folders `class_03`–`class_05` and the "Class 03/04/05" tags in the
techniques panel follow the repo's own exercise numbering (03 noise and terrain, 04 voxels and
CSG, 05 shader lab), not the session numbers above.

## Grading and deliverables

- Weekly push with a short progress report (what was done, how AI was used, what worked, next) — 15%.
- Three progress presentations (7–10 min, self-scheduled) — 15%.
- Midterm exhibition (Oct 14): the atlas as a coherent body of research — 15%.
- Final review exhibition (Dec 2): conceptual ambition, procedural systems, current state — 25%.
- Final deliverables (Dec 18) — 15%: GitHub repo with a substantial README (premise, techniques
  for geography / ecologies / populations / behaviors / narratives, role of AI, main algorithms,
  how to run, credits, with images and diagrams); a public interactive website presenting a
  complete environment; a short video reel (identity, key systems, interaction, change over time,
  emergent behavior); an image set (PDF, JPG, PNG or TIFF, labelled last name, first name, program).
- Participation — 15%.
- Rubric: project ambition; work ethic; design (design position, avoiding tropes, use and
  transformation of precedents, originality, aesthetic intent); research (modeling, method,
  documentation); overall execution and visual communication.

## Readings

Main: *Procedural Content Generation in Games* (Shaker, Togelius, Nelson); *Procedural Generation
in Game Design* (Short, Adams). Additional: *The Nature of Code*; *The Algorithmic Beauty of
Plants*; *Texturing & Modeling: A Procedural Approach*; *Form+Code*; *Generative Design*;
*Thinking in Systems*; *The Model Thinker*; *A New Kind of Science*; *Discover three.js*.

## What this means for Guixu

- Prefer systems that respond and change over time (time of day, seasons or solar terms,
  drifting islands, growth) over fixed presets; this is what "ever-changing environment" asks for.
- Map new features to upcoming sessions where they fit: wind as a vector field (session 6),
  vegetation by L-systems and growth/distribution rules (session 7), creatures (sessions 9–10),
  cultures and Shanhaijing entries (session 11).
- Keep each technique visible as its own atlas entry for the midterm, with its source credited.
- Keep notes and the README current: they become the final documentation.
