import { createRng } from '../world/noise';
import { BEATS, CAUSES, ERA_TITLES, FILLERS, SITES, WHY, type BeatId, type Card, type Cause, type Holder, type T2, type Tag } from './world';

export type Palette = Record<Tag, boolean>;

export interface Move {
  card?: Card;
  /** Set when the palette leaves no way to reach the ending. */
  blocked?: BeatId;
}

const fits = (c: Cause, palette: Palette, holder?: Holder) => c.tags.every((t) => palette[t]) && (!c.only || c.only === holder);

const pick = <T,>(list: T[], rng: () => number) => list[Math.floor(rng() * list.length)];

let counter = 0;
const newId = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * The computer's turn. It reads the board, finds the first thing the end bookend needs that has
 * not happened yet, and writes it with a cause the palette allows. With a focus, it plays on the focus.
 */
export function computerMove(cards: Card[], focusId: string | null, palette: Palette, rng: () => number, skip: BeatId[] = []): Move {
  const done = new Set<BeatId>([...cards.flatMap((c) => (c.beat ? [c.beat] : [])), ...skip]);
  const holder = cards.find((c) => c.holder)?.holder;
  const focus = cards.find((c) => c.id === focusId);
  const eras = cards.filter((c) => c.kind === 'era');
  const ready = BEATS.filter((b) => !done.has(b.id) && b.needs.every((n) => done.has(n)));

  const make = (beat: BeatId | undefined, cause: Cause, kind: Card['kind'], parent: string | null, why: T2, group?: number): Card => ({
    id: newId(), kind, parent, tone: cause.tone, title: cause.title, text: cause.text, author: 'computer', beat, why, group, holder: cause.holder,
  });

  if (focus) {
    // Lens round: everything connects to the focus.
    if (focus.kind === 'era') {
      const beat = ready.find((b) => b.group === focus.group);
      if (beat) {
        const options = CAUSES[beat.id]().filter((c) => fits(c, palette, holder));
        if (!options.length) return { blocked: beat.id };
        return { card: make(beat.id, pick(options, rng), 'event', focus.id, WHY[beat.id]) };
      }
      return { card: make(undefined, steer(focus, cards, FILLERS, palette, rng, holder), 'event', focus.id, STEER_WHY) };
    }
    return { card: make(undefined, steer(focus, cards, SITES, palette, rng, holder), 'site', focus.id, ZOOM_WHY) };
  }

  const beat = ready[0];
  if (!beat) return {};
  const options = CAUSES[beat.id]().filter((c) => fits(c, palette, holder));
  if (!options.length) return { blocked: beat.id };
  const cause = pick(options, rng);
  const era = [...eras].reverse().find((e) => e.group === beat.group);
  // A beat that belongs to a later part of the story opens a new era; otherwise it hangs under its era.
  return era
    ? { card: make(beat.id, cause, 'event', era.id, WHY[beat.id]) }
    : { card: { ...make(beat.id, cause, 'era', null, WHY[beat.id], beat.group), title: eraTitle(beat.group, cause.title, rng) } };
}

const STEER_WHY: T2 = { zh: '这一段已经有该发生的事了，补一件基调相反的，让它有起伏。', en: 'This part already has what it needs; I add something of the opposite tone so it has ups and downs.' };
const ZOOM_WHY: T2 = { zh: '镜头拉近：给这件事一个具体的地方。', en: 'Zooming in: a concrete place for this event.' };

/** Prefer the tone the focus's children lack, so a part of the story never stays one colour. */
function steer(focus: Card, cards: Card[], pool: Cause[], palette: Palette, rng: () => number, holder?: Holder): Cause {
  const kids = cards.filter((c) => c.parent === focus.id);
  const dark = kids.filter((k) => k.tone === 'dark').length + (focus.tone === 'dark' ? 1 : 0);
  const light = kids.length + 1 - dark;
  const want = dark > light ? 'light' : light > dark ? 'dark' : rng() < 0.5 ? 'light' : 'dark';
  const used = new Set(cards.map((c) => c.title.en));
  const options = pool.filter((c) => fits(c, palette, holder) && !used.has(c.title.en));
  const toned = options.filter((c) => c.tone === want);
  return pick(toned.length ? toned : options.length ? options : pool, rng);
}

export interface History {
  cards: Card[];
  blocked?: BeatId;
}

/** The computer plays alone from the two bookends: one of the many middles that reach the same ending. */
export function autoplay(palette: Palette, seed: number, start: Card[] = []): History {
  const rng = createRng(seed * 977 + 5);
  const cards: Card[] = [...start];
  const skip: BeatId[] = rng() < 0.35 ? ['rivalry'] : [];
  for (let step = 0; step < 24; step++) {
    if (cards.some((c) => c.beat === 'settle')) break; // the end bookend is reached
    // Now and then, a card the ending does not need, so no two histories have the same rhythm.
    const last = [...cards].reverse().find((c) => c.kind === 'era');
    if (last && rng() < 0.3) {
      const extra = computerMove(cards, last.id, palette, rng, skip).card;
      if (extra) cards.push(extra);
      continue;
    }
    const move = computerMove(cards, null, palette, rng, skip);
    if (move.blocked) return { cards, blocked: move.blocked };
    if (!move.card) break;
    cards.push(move.card);
  }
  return { cards };
}

/** A new era is named for its part of the story, followed by what opens it. */
function eraTitle(group: number, first: T2, rng: () => number): T2 {
  const name = pick(ERA_TITLES[group], rng);
  return { zh: `${name.zh}：${first.zh}`, en: `${name.en}: ${first.en}` };
}
