/**
 * Guixu Chronicle: the world we set up when we played Microscope (big picture, bookends, palette),
 * plus the pieces the computer player builds its cards from.
 */

export type Tone = 'light' | 'dark'; // flourishing / strained
export type Kind = 'era' | 'event' | 'site';
export type T2 = { zh: string; en: string };
export type Author = 'first' | 'you' | 'computer';

export interface Card {
  id: string;
  kind: Kind;
  tone: Tone;
  title: T2;
  text: T2;
  parent: string | null; // events hang under an era, sites under an event
  author: Author;
  beat?: BeatId;
  group?: number; // eras only: which part of the history they cover
  holder?: Holder; // set by the card that first holds the mountains up
  why?: T2; // the computer explains each of its cards
  legacy?: boolean;
}

export const BIG_PICTURE: T2 = {
  zh: '归墟吞下天下所有的水却永远不满，五座仙山浮在它上方，靠一种脆弱的平衡才没有坠落。',
  en: 'Guixu swallows all the waters of the world and is never full; five immortal mountains float above it, kept from falling only by a fragile balance.',
};

export const BOOKENDS: { start: { text: T2; tone: Tone }; end: { text: T2; tone: Tone } } = {
  start: {
    tone: 'dark',
    text: {
      zh: '五座仙山（岱舆、员峤、方壶、瀛洲、蓬莱）浮在归墟之上，没有根，随潮水漂流。仙人住在山上，却担心山会漂走。',
      en: 'Five mountains (Daiyu, Yuanjiao, Fanghu, Yingzhou, Penglai) float over Guixu with no roots, drifting with the tide. The immortals live on them and fear they will drift away.',
    },
  },
  end: {
    tone: 'light',
    text: {
      zh: '只剩三山（方壶、瀛洲、蓬莱）还浮在归墟上。岱舆和员峤漂到北方，沉入了深渊，山上的仙人四散。',
      en: 'Only three remain (Fanghu, Yingzhou, Penglai). Daiyu and Yuanjiao drifted north and sank into the abyss; their immortals scattered.',
    },
  },
};

/** Palette items. Each tag can sit in YES (allowed) or NO (forbidden); the computer only uses allowed ones. */
export type Tag = 'turtle' | 'cloud' | 'giant' | 'magic' | 'mortal' | 'return';
export const TAGS: Tag[] = ['turtle', 'cloud', 'giant', 'magic', 'mortal', 'return'];
export const FIRST_PALETTE: Record<Tag, boolean> = { turtle: true, cloud: true, giant: true, magic: false, mortal: false, return: false };
export const TAG_TEXT: Record<Tag, T2> = {
  turtle: { zh: '巨鳌', en: 'Giant turtles' },
  cloud: { zh: '云海', en: 'Sea of clouds' },
  giant: { zh: '龙伯巨人', en: 'The Longbo giants' },
  magic: { zh: '让山直接停下的法术', en: 'Magic that simply stops a mountain' },
  mortal: { zh: '凡人', en: 'Mortals' },
  return: { zh: '沉下去的东西回来', en: 'What sinks coming back' },
};

export const MOUNTAINS = {
  daiyu: { zh: '岱舆', en: 'Daiyu' },
  yuanjiao: { zh: '员峤', en: 'Yuanjiao' },
} as const;
type Lost = keyof typeof MOUNTAINS;

/**
 * Beats: what the end bookend says must have happened. The middle is open, the ending is not:
 * the computer fills the missing beats, each with one of several possible causes.
 */
export type BeatId = 'hold' | 'rivalry' | 'lose-yuanjiao' | 'lose-daiyu' | 'sink' | 'scatter' | 'settle';
export const BEATS: { id: BeatId; group: number; needs: BeatId[]; optional?: boolean }[] = [
  { id: 'hold', group: 0, needs: [] },
  { id: 'rivalry', group: 1, needs: ['hold'], optional: true },
  { id: 'lose-yuanjiao', group: 1, needs: ['hold'] },
  { id: 'lose-daiyu', group: 2, needs: ['hold'] },
  { id: 'sink', group: 2, needs: ['lose-yuanjiao', 'lose-daiyu'] },
  { id: 'scatter', group: 2, needs: ['sink'] },
  { id: 'settle', group: 3, needs: ['sink'] },
];

export const WHY: Record<BeatId, T2> = {
  hold: { zh: '开头的山还在漂，结尾的三山却稳稳的：总得有什么先把山托住。', en: 'At the start the mountains drift; at the end three stand still. Something has to hold them first.' },
  rivalry: { zh: '山一旦不动，位置的好坏也就定了。', en: 'Once the mountains stop, good and bad positions are fixed too.' },
  'lose-yuanjiao': { zh: '结局里员峤沉了，可它还被托着。', en: 'Yuanjiao sinks in the ending, but it is still held up.' },
  'lose-daiyu': { zh: '结局里岱舆沉了，可它还被托着。', en: 'Daiyu sinks in the ending, but it is still held up.' },
  sink: { zh: '两座山都没了依靠，结局要它们沉下去。', en: 'Both mountains have lost their support; the ending needs them to sink.' },
  scatter: { zh: '结局说山上的仙人四散，这还没写。', en: 'The ending says their immortals scattered; that is not written yet.' },
  settle: { zh: '结尾是“繁荣”，剩下的三山需要安定下来。', en: 'The ending is flourishing: the three that remain need to settle.' },
};

export type Holder = 'turtle' | 'cloud' | 'magic' | 'giant';

export interface Cause {
  title: T2;
  text: T2;
  tone: Tone;
  tags: Tag[];
  holder?: Holder; // for 'hold': what now carries the mountains
  only?: Holder; // for later beats: only fits if this is what holds them
}

const m = (s: T2, k: Lost, title?: T2): T2 => ({
  zh: s.zh.replaceAll('{m}', MOUNTAINS[k].zh).replace('{t}', title?.zh ?? ''),
  en: s.en.replaceAll('{m}', MOUNTAINS[k].en).replace('{t}', title?.en ?? ''),
});
const TITLE_M: T2 = { zh: '{m}：{t}', en: '{m}: {t}' };

const LOSE: Cause[] = [
  { tone: 'dark', tags: ['giant', 'turtle'], only: 'turtle', title: { zh: '龙伯钓鳌', en: 'The giant’s line' }, text: { zh: '龙伯国的巨人几步跨过大海，一竿钓走了托{m}的三只巨鳌。', en: 'A Longbo giant crossed the sea in a few steps and hooked the three turtles under {m}.' } },
  { tone: 'dark', tags: ['turtle'], only: 'turtle', title: { zh: '巨鳌累死', en: 'The turtles give out' }, text: { zh: '托{m}的巨鳌六万年没人来换班，最后累死了。', en: 'No one came to relieve the turtles under {m} for sixty thousand years; they died of exhaustion.' } },
  { tone: 'dark', tags: ['turtle'], only: 'turtle', title: { zh: '巨鳌游走', en: 'The turtles leave' }, text: { zh: '{m}上早已没人祭拜，巨鳌觉得没意思，游走了。', en: 'No one on {m} honoured the turtles any more, so they swam away.' } },
  { tone: 'dark', tags: ['mortal', 'turtle'], only: 'turtle', title: { zh: '渔夫误捕', en: 'A fisherman’s net' }, text: { zh: '一个凡人渔夫的网缠住了托{m}的巨鳌。', en: 'A mortal fisherman’s net tangled the turtles under {m}.' } },
  { tone: 'dark', tags: ['cloud'], only: 'cloud', title: { zh: '云柱吹散', en: 'The cloud pillar breaks' }, text: { zh: '北风一年比一年冷，托{m}的云柱被吹散了。', en: 'The north wind grew colder each year until the cloud pillar under {m} blew apart.' } },
  { tone: 'dark', tags: ['magic'], only: 'magic', title: { zh: '咒语失传', en: 'The spell is forgotten' }, text: { zh: '会念钉山咒的仙人都离开了{m}，咒语失效了。', en: 'Every immortal who knew the binding spell had left {m}; the spell failed.' } },
  { tone: 'dark', tags: ['giant'], only: 'giant', title: { zh: '巨人松手', en: 'The giant lets go' }, text: { zh: '托着{m}的巨人老了，手一松。', en: 'The giant holding up {m} grew old, and his hands opened.' } },
];

export const CAUSES: Record<BeatId, (lost?: Lost) => Cause[]> = {
  hold: () => [
    { tone: 'light', tags: ['turtle'], holder: 'turtle', title: { zh: '巨鳌之约', en: 'The turtle pact' }, text: { zh: '天帝派禺强带来十五只巨鳌，三只一组托住一座山，六万年换一次班。', en: 'The Lord of Heaven sent Yuqiang with fifteen turtles; three by three they carry each mountain, changing shifts every sixty thousand years.' } },
    { tone: 'light', tags: ['cloud'], holder: 'cloud', title: { zh: '云海成柱', en: 'Pillars of cloud' }, text: { zh: '云海在每座山下凝成一根柱子，把山稳稳托住。', en: 'The sea of clouds thickened into a pillar under each mountain and held it still.' } },
    { tone: 'light', tags: ['magic'], holder: 'magic', title: { zh: '钉山咒', en: 'The binding spell' }, text: { zh: '仙人合力念咒，把五座山钉在了归墟上空。', en: 'The immortals chanted together and pinned the five mountains above Guixu.' } },
    { tone: 'light', tags: ['giant'], holder: 'giant', title: { zh: '巨人托山', en: 'Giants for hire' }, text: { zh: '仙人请来龙伯国的巨人，一人托住一座山。', en: 'The immortals hired Longbo giants, one to hold up each mountain.' } },
  ],
  rivalry: () => [
    { tone: 'dark', tags: [], title: { zh: '方位之争', en: 'The quarrel over places' }, text: { zh: '山不动了，朝东的山先得阳光雨水，朝北的终年冷风。仙人开始争好位置。', en: 'With the mountains fixed, the eastern ones got sun and rain first, the northern ones only cold wind. The immortals began fighting over places.' } },
    { tone: 'dark', tags: ['cloud'], title: { zh: '雨只下在南边', en: 'Rain only in the south' }, text: { zh: '云海只往南边下雨，北边的两座山越来越干。', en: 'The clouds only rained on the south; the two northern mountains dried out.' } },
  ],
  'lose-yuanjiao': () => LOSE.map((c) => ({ ...c, title: m(TITLE_M, 'yuanjiao', c.title), text: m(c.text, 'yuanjiao') })),
  'lose-daiyu': () => LOSE.map((c) => ({ ...c, title: m(TITLE_M, 'daiyu', c.title), text: m(c.text, 'daiyu') })),
  sink: () => [
    { tone: 'dark', tags: [], title: { zh: '北漂', en: 'Drift north' }, text: { zh: '没了托举，岱舆和员峤随潮漂向北方，沉进了归墟。', en: 'With nothing beneath them, Daiyu and Yuanjiao drifted north on the tide and sank into Guixu.' } },
    { tone: 'dark', tags: [], title: { zh: '两山相撞', en: 'The two collide' }, text: { zh: '两座山在潮水里撞在一起，一同沉了下去。', en: 'The two mountains struck each other in the tide and went down together.' } },
  ],
  scatter: () => [
    { tone: 'dark', tags: [], title: { zh: '逃往三山', en: 'Refugees on three mountains' }, text: { zh: '两山的仙人逃到剩下的三山，挤在一起过日子。', en: 'The immortals of the lost mountains fled to the three that remained and crowded in.' } },
    { tone: 'dark', tags: [], title: { zh: '深渊里的光', en: 'Lights in the abyss' }, text: { zh: '不肯走的仙人随山沉下去，成了归墟深处的光点。', en: 'Those who would not leave sank with their mountains and became points of light deep in Guixu.' } },
    { tone: 'dark', tags: ['cloud'], title: { zh: '化为云', en: 'Turned to cloud' }, text: { zh: '仙人散进云海，慢慢变成了云。', en: 'The immortals dispersed into the sea of clouds and slowly became cloud.' } },
    { tone: 'dark', tags: ['mortal'], title: { zh: '凡人收留', en: 'Taken in by mortals' }, text: { zh: '逃难的仙人落到凡间，被凡人收留。', en: 'The fleeing immortals fell to the human world and were taken in by mortals.' } },
  ],
  settle: () => [
    { tone: 'light', tags: ['turtle'], only: 'turtle', title: { zh: '九鳌重排', en: 'Nine turtles, new shifts' }, text: { zh: '剩下的巨鳌重新排班，九只守三山，从此再没出错。', en: 'The remaining turtles were given new shifts, nine for three mountains, and never failed again.' } },
    { tone: 'light', tags: ['cloud'], only: 'cloud', title: { zh: '云海更厚', en: 'Thicker clouds' }, text: { zh: '云海从此只托三座山，柱子变得又粗又稳。', en: 'Now holding only three mountains, the cloud pillars grew thick and steady.' } },
    { tone: 'light', tags: ['magic'], only: 'magic', title: { zh: '咒语刻进山石', en: 'The spell in stone' }, text: { zh: '三山的仙人把咒语刻进山石，不再靠人记。', en: 'The immortals carved the spell into the rock so no one has to remember it.' } },
    { tone: 'light', tags: ['giant'], only: 'giant', title: { zh: '巨人立誓', en: 'The giants’ oath' }, text: { zh: '剩下的巨人立誓，一直托到最后。', en: 'The remaining giants swore to hold on to the end.' } },
    { tone: 'light', tags: [], title: { zh: '三山之约', en: 'The pact of three' }, text: { zh: '三山的仙人约定：再也不争位置。', en: 'The immortals of the three mountains agreed never to fight over places again.' } },
  ],
};

/** Cards that are not required by the ending: they make the middle richer and steer the tone. */
export const FILLERS: Cause[] = [
  { tone: 'light', tags: ['cloud'], title: { zh: '云海丰年', en: 'A rich year of clouds' }, text: { zh: '云海涨得很高，五座山都下了好雨。', en: 'The clouds rose high and every mountain had good rain.' } },
  { tone: 'light', tags: [], title: { zh: '仙草大熟', en: 'The herb harvest' }, text: { zh: '瀛洲的仙草大熟，送了一些给别的山。', en: 'Yingzhou’s herbs ripened and some were shared with the other mountains.' } },
  { tone: 'light', tags: [], title: { zh: '蓬莱观潮', en: 'Tide-watching on Penglai' }, text: { zh: '五山的仙人聚在蓬莱山顶看潮。', en: 'Immortals from all five mountains gathered on Penglai’s peak to watch the tide.' } },
  { tone: 'dark', tags: [], title: { zh: '寒潮', en: 'The cold tide' }, text: { zh: '一场寒潮从北边涌来，北边的山结了冰。', en: 'A cold tide came from the north and the northern mountains froze.' } },
  { tone: 'dark', tags: ['turtle'], only: 'turtle', title: { zh: '换班出错', en: 'A missed shift' }, text: { zh: '巨鳌换班时晚了一刻，山晃了一下。', en: 'A turtle came late to its shift and the mountain shook.' } },
  { tone: 'dark', tags: ['return'], title: { zh: '捞回山石', en: 'Stone brought back' }, text: { zh: '有仙人从归墟里捞回一块岱舆的山石。', en: 'An immortal brought a stone of Daiyu back up from Guixu.' } },
];

export const SITES: Cause[] = [
  { tone: 'dark', tags: [], title: { zh: '空宫殿', en: 'The empty palace' }, text: { zh: '山顶的宫殿门开着，里面已经没人。', en: 'The palace doors on the peak stand open; no one is inside.' } },
  { tone: 'dark', tags: ['turtle'], only: 'turtle', title: { zh: '巨鳌的背', en: 'The turtle’s back' }, text: { zh: '巨鳌背上长满了青苔，壳上有一道裂缝。', en: 'Moss covers the turtle’s back, and a crack runs across its shell.' } },
  { tone: 'light', tags: [], title: { zh: '山顶的池水', en: 'The pool on the peak' }, text: { zh: '一池水，映着云海，从来没干过。', en: 'A pool that mirrors the clouds and has never run dry.' } },
  { tone: 'light', tags: ['cloud'], title: { zh: '云海边的石台', en: 'The ledge above the clouds' }, text: { zh: '仙人常坐在这里，看云海一层层地涨落。', en: 'Immortals sit here to watch the clouds rise and fall.' } },
  { tone: 'dark', tags: ['giant'], title: { zh: '龙伯钓台', en: 'The giant’s fishing rock' }, text: { zh: '海尽头的一块巨石，巨人坐在上面垂钓。', en: 'A huge rock at the end of the sea where the giants sit and fish.' } },
];

export const ERA_TITLES: Record<number, T2[]> = {
  0: [{ zh: '托山之世', en: 'The age of holding' }],
  1: [{ zh: '失衡之年', en: 'Years of imbalance' }, { zh: '北风之年', en: 'Years of the north wind' }],
  2: [{ zh: '沉没之年', en: 'The sinking' }, { zh: '北漂之年', en: 'The drift north' }],
  3: [{ zh: '三山之世', en: 'The age of three' }],
};

/** The game we played in chat on 2026-10-10: the first saved history. */
export const FIRST_GAME: Card[] = [
  { id: 'c1', kind: 'era', tone: 'light', parent: null, author: 'first', group: 0, beat: 'hold', holder: 'turtle', title: CAUSES.hold()[0].title, text: CAUSES.hold()[0].text },
  { id: 'c2', kind: 'era', tone: 'dark', parent: null, author: 'first', group: 1, beat: 'rivalry', title: { zh: '方位之争', en: 'The quarrel over places' }, text: { zh: '各个岛屿因为方位不同，有的资源更好，开始争夺。', en: 'Because of where they sit, some islands have better resources, and the islands start to fight over them.' } },
  { id: 'c3', kind: 'event', tone: 'dark', parent: 'c2', author: 'first', title: { zh: '员峤的仙草枯了', en: 'Yuanjiao’s herbs wither' }, text: { zh: '北风越来越冷，员峤的仙草枯死。去瀛洲借草种，被拒绝了。', en: 'The north wind grew colder and Yuanjiao’s herbs died. Yingzhou refused to lend seeds.' } },
  { id: 'c4', kind: 'event', tone: 'dark', parent: 'c3', author: 'first', legacy: true, title: { zh: '员峤的仙人想离开', en: 'Yuanjiao’s immortals want to leave' }, text: { zh: '员峤的仙人开始想办法离开这座山。（遗产：空山，巨鳌没人照看）', en: 'Yuanjiao’s immortals start looking for a way off the mountain. (Legacy: an empty mountain; no one tends its turtles.)' } },
];
