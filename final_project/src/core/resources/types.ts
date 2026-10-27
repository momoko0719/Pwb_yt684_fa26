/**
 * Shared resource / scale types. Config ranges live beside generators;
 * atlas + ScaleView both read ResourceDef lists assembled per island.
 */
export type ResourceCategory = 'vegetation' | 'creatures' | 'props' | 'terrain';
export type ResourceIsland = 'wonderland' | 'penglai';

export interface SizeBox {
  height?: [number, number];
  width?: [number, number];
  depth?: [number, number];
}

export interface ResourceDef {
  id: string;
  category: ResourceCategory;
  nameKey: string;
  islands: ResourceIsland[];
  /** Generator-allowed size (config). */
  config: SizeBox;
  variants?: number;
  ruleEn: string;
  ruleZh: string;
  preview: 'shrub' | 'grass' | 'pine' | 'person' | 'stele' | 'flower' | null;
  noteEn?: string;
  noteZh?: string;
}

export function formatSizeBox(box: SizeBox, unit = 'm'): string {
  const parts: string[] = [];
  const fmt = (r: [number, number]) => (r[0] === r[1] ? `${r[0].toFixed(2)}` : `${r[0].toFixed(2)}–${r[1].toFixed(2)}`);
  if (box.height) parts.push(`H ${fmt(box.height)}`);
  if (box.width) parts.push(`W ${fmt(box.width)}`);
  if (box.depth) parts.push(`D ${fmt(box.depth)}`);
  return parts.length ? `${parts.join(' · ')} ${unit}` : '—';
}
