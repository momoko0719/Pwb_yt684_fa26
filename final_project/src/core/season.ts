/**
 * The 24 solar terms (二十四节气) as the island's year. Position in the year is a continuous number
 * 0..24: 0 is the Start of Spring (立春, about Feb 4), each term about 15.2 days. Each quantity the
 * world reads is one small rule of that number. Pure functions.
 *
 * 0 立春 1 雨水 2 惊蛰 3 春分 4 清明 5 谷雨 6 立夏 7 小满 8 芒种 9 夏至 10 小暑 11 大暑
 * 12 立秋 13 处暑 14 白露 15 秋分 16 寒露 17 霜降 18 立冬 19 小雪 20 大雪 21 冬至 22 小寒 23 大寒
 */
export const TERM_COUNT = 24;

const DAY = 86_400_000;
const TERM_DAYS = 365.2422 / TERM_COUNT;

/** Where a date falls in the year of terms (0..24), counting from the Start of Spring on Feb 4. */
export function termOfDate(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 1, 4);
  let days = (date.getTime() - start) / DAY;
  if (days < 0) days += 365.2422;
  return (days / TERM_DAYS) % TERM_COUNT;
}

const wrap = (y: number) => ((y % TERM_COUNT) + TERM_COUNT) % TERM_COUNT;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
/** A bump that rises from `a` to `b`, holds until `c`, and falls back by `d` (all in terms, wrapping). */
function season(y: number, a: number, b: number, c: number, d: number): number {
  const x = wrap(y - a); // measure from the start of the bump
  return smooth(0, wrap(b - a), x) * (1 - smooth(wrap(c - a), wrap(d - a), x));
}

export interface SeasonState {
  /** 0..1, how green and grown the meadow is: green from Pure Brightness, full in summer. */
  green: number;
  /** 0..1, autumn gold, from the End of Heat to the Frost Descent. */
  gold: number;
  /** 0..1, snow on the peaks, the pines and (deep in winter) the meadow. */
  snow: number;
  /** 0..1, whether the Zhuyu flowers are in season (Awakening of Insects to White Dew). */
  bloom: number;
  /** Degrees added to the sun's height: higher in summer, lower in winter. */
  sunShift: number;
}

export function seasonAt(y: number): SeasonState {
  const t = wrap(y);
  return {
    green: season(t, 2, 6, 13, 17),
    gold: season(t, 12.5, 15, 17, 19.5),
    snow: season(t, 18.5, 21, 0, 2.5),
    bloom: season(t, 1.5, 3, 14, 15.5),
    sunShift: 9 * Math.cos((2 * Math.PI * (t - 9)) / TERM_COUNT), // highest at the Summer Solstice (9)
  };
}
