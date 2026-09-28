export type StudyCategory =
  | 'basics'
  | 'gradients'
  | 'spatial'
  | 'materials'
  | 'geometry'
  | 'final';

export type ParamKind = 'float' | 'bool' | 'color' | 'select';

export interface ParamDef {
  key: string;
  label: string;
  kind: ParamKind;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default: number | boolean | string;
}

export interface StudyMeta {
  id: string;
  category: StudyCategory;
  name: string;
  short: string;
  hasMask?: boolean;
  params: ParamDef[];
  snippet?: string;
}

export type ParamValues = Record<string, number | boolean | string>;

export const CATEGORY_LABELS: Record<StudyCategory, string> = {
  basics: 'Basics',
  gradients: 'Gradients',
  spatial: 'Spatial Effects',
  materials: 'Materials & Interaction',
  geometry: 'Geometry',
  final: 'Final Combination',
};

export const CATEGORY_ORDER: StudyCategory[] = [
  'basics', 'gradients', 'spatial', 'materials', 'geometry', 'final',
];
