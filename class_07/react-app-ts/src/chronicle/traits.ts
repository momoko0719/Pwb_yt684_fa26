import type { History } from './play';
import type { Card } from './world';

/**
 * History → world. Each kind of event leaves a visible trace on the three mountains that remain,
 * so the same ending looks different depending on how it was reached.
 */
export type Trace =
  | 'turtles' | 'cloudPillar' | 'giantHands' | 'runes' // what holds the mountains up
  | 'walls' | 'fishingLine' | 'ghosts' | 'collided'
  | 'refugees' | 'abyssLights' | 'thickCloud'
  | 'snow' | 'lush' | 'bridges' | 'stone';

/** Keyed by the (Chinese) title of a cause; era titles contain the cause title too. */
const BY_TITLE: [string, Trace][] = [
  ['巨鳌之约', 'turtles'], ['九鳌重排', 'turtles'],
  ['云海成柱', 'cloudPillar'],
  ['巨人托山', 'giantHands'], ['巨人立誓', 'giantHands'],
  ['钉山咒', 'runes'], ['咒语刻进山石', 'runes'],
  ['方位之争', 'walls'], ['雨只下在南边', 'walls'],
  ['龙伯钓鳌', 'fishingLine'],
  ['北漂', 'ghosts'], ['两山相撞', 'collided'],
  ['逃往三山', 'refugees'], ['深渊里的光', 'abyssLights'], ['化为云', 'thickCloud'], ['云海更厚', 'thickCloud'],
  ['寒潮', 'snow'], ['云海丰年', 'lush'], ['仙草大熟', 'lush'],
  ['三山之约', 'bridges'], ['捞回山石', 'stone'],
];

export interface World {
  traces: Set<Trace>;
  steps: Card[]; // the history in order, for the caption
}

export function toWorld(h: History): World {
  const traces = new Set<Trace>();
  for (const c of h.cards) for (const [key, trace] of BY_TITLE) if (c.title.zh.includes(key)) traces.add(trace);
  // Order: each era followed by what hangs under it.
  const steps: Card[] = [];
  const add = (c: Card) => {
    steps.push(c);
    h.cards.filter((k) => k.parent === c.id).forEach(add);
  };
  h.cards.filter((c) => c.kind === 'era').sort((a, b) => (a.group ?? 0) - (b.group ?? 0)).forEach(add);
  return { traces, steps };
}
