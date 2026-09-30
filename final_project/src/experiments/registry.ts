import type { ComponentType } from 'react';
import type { Language } from '../i18n/strings';
import external from './external.json';

export type Localized = Record<Language, string>;
export type EntryKind = 'class-exercise' | 'world-study';

export type TechniqueSource = 'class-03' | 'class-04' | 'class-05' | 'outside';

/** One step of an experiment's pipeline, shown in its Techniques panel. Text lives in strings.ts under tech.<id>.*. */
export interface TechniqueEntry {
  id: string;
  source: TechniqueSource;
  /** True when the step builds on the class technique rather than using it as taught. */
  derived?: boolean;
  /** Ids of the live 2D maps for this step, in order, if there are any. */
  stages?: string[];
  /** Leva keys that change this step. */
  params: string[];
}

export interface ExperimentMeta {
  id: string;
  kind: EntryKind;
  title: Localized;
  session: number;
  techniques: string[];
  techniqueMap?: TechniqueEntry[];
  date: string;
  status: string;
  summary: Localized;
}

/** Hand-written card pointing at a separately deployed site. */
export interface ExternalEntry extends ExperimentMeta {
  url: string;
}

export interface Experiment {
  meta: ExperimentMeta;
  load: () => Promise<{ default: ComponentType }>;
}

const metas = import.meta.glob<ExperimentMeta>('./*/meta.json', { eager: true, import: 'default' });
const scenes = import.meta.glob<{ default: ComponentType }>('./*/Scene.tsx');

const byDateDesc = (a: ExperimentMeta, b: ExperimentMeta) => b.date.localeCompare(a.date);

export const experiments: Experiment[] = Object.entries(metas)
  .map(([path, meta]) => ({ meta, load: scenes[path.replace('meta.json', 'Scene.tsx')] }))
  .filter((e) => e.load)
  .sort((a, b) => byDateDesc(a.meta, b.meta));

export const externalEntries = (external as ExternalEntry[]).slice().sort(byDateDesc);
