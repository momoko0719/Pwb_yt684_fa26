# Class 07 — Guixu Chronicle 归墟编年 (Assignment 2: procedural world building)

App: `class_07/react-app-ts/` → top right, **Assignment 2 · Guixu Chronicle**.

**Idea in one line**: the computer makes up a history by a few rules, then draws the world that history leaves behind. Every world starts and ends the same way (five mountains → three), but each one carries different marks.

## Where it comes from: one game of Microscope

I had no one to play with, so I played a short game in chat with Claude, following the class rules.

- **Big picture**: Guixu swallows all the waters of the world and is never full; five mountains float above it, kept from falling only by a fragile balance.
- **Bookends** (from the *Liezi*): start ☁ five mountains drift; end ☀ three remain, Daiyu and Yuanjiao sank in the north.
- **Palette**: YES giant turtles, sea of clouds, Longbo giants · NO magic that simply stops a mountain, mortals, what sinks coming back.
- **Cards**: the turtle pact ☀ (Claude) → the quarrel over places ☁ (me) → Yuanjiao's herbs wither ☁ (Claude, focus on Yuanjiao) → Yuanjiao's immortals want to leave ☁ (me) → legacy: an empty mountain.

What I took from it: Microscope fixes the ending, so the game is about *how* it could have happened. The rules (bookends, palette, every card must connect to an earlier one) work like a grammar.

## The system

1. **Rules** (`src/chronicle/world.ts`)
   - The end bookend becomes a list of things that must happen: something holds the mountains up → each of the two loses its support → they sink → their immortals scatter → the three left settle.
   - Each of those has several possible causes. The mountains can be held by turtles, cloud pillars, giants or a spell. A mountain loses its turtles to a giant's fishing line, to exhaustion or to neglect; it loses a cloud pillar to the north wind.
   - Causes must fit what holds the mountains and what the palette allows.
2. **History** (`src/chronicle/play.ts`): starting from the bookends, the computer picks the next missing step and a random allowed cause, sometimes adding an extra event (a cold tide, a good year). World 1 continues the game we played; the others start from scratch.
3. **World** (`src/chronicle/traits.ts`, `MiniWorld.tsx`): every kind of event leaves a visible trace on the three mountains:

| In the history | In the world |
| --- | --- |
| held by turtles / cloud pillars / giants / a spell | turtles, white pillars, giant hands or a golden ring under each mountain |
| the quarrel over places | red walls, mountains farther apart |
| the giant fished the turtles | a fishing line hanging from the sky |
| the two sank / collided | two faint mountains deep below, apart or crushed together |
| immortals fled to the three / sank as lights / became cloud | crowded houses / lights in the abyss / a thick sea of clouds |
| a cold tide / good years | snow on the peaks / greener tops |
| the pact of three | bridges between the mountains |

- **Palette as rules**: click a word to allow or forbid it. Forbid *giant turtles* and *giants* and the mountains are held by clouds or nothing at all; forbid everything that can hold them and the history gets stuck. Fewer things allowed means fewer ways to reach the ending.

## What this means for "procedural world building"

The world is not drawn directly: rules generate a history, and the history decides what the world looks like (like *Dwarf Fortress* simulating centuries before you play). For Guixu, each island's look (what holds it, who lives there, what is missing) could come from a generated history instead of being placed by hand.

## Files

| File | What it does |
| --- | --- |
| `src/chronicle/world.ts` | big picture, bookends, palette, required steps and their causes, the game we played |
| `src/chronicle/play.ts` | picks the next step and a cause; plays a whole history |
| `src/chronicle/traits.ts` | history → visible traces |
| `src/chronicle/MiniWorld.tsx` | draws the three mountains with their traces |
| `src/chronicle/Chronicle.tsx` | the page: rules, six worlds, the game record |
