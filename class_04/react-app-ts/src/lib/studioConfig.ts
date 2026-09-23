/**
 * Serializable Clay Studio configuration (Assignment 2: save / load).
 */
import type { DensityShape, DensityParams } from './density';
import { DEFAULT_DENSITY } from './density';
import type { PrimitiveKind, CsgOp } from './sdf';

export type StationId = 'density' | 'csg' | 'meshing' | 'chunking';
export type MeshMethod = 'culled' | 'marching';

export interface StudioConfig {
  version: 1;
  station: StationId;
  density: {
    shape: DensityShape;
    params: DensityParams;
    resolution: number;
    threshold: number;
    wireframe: boolean;
  };
  csg: {
    shapeA: PrimitiveKind;
    shapeB: PrimitiveKind;
    op: CsgOp;
    smoothK: number;
    thickness: number;
    wireframe: boolean;
  };
  meshing: {
    method: MeshMethod;
    resolution: number;
    wireframe: boolean;
  };
  chunking: {
    worldEdge: number;
    chunkEdge: number;
    radius: number;
  };
}

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  version: 1,
  station: 'density',
  density: {
    shape: 'ground',
    params: { ...DEFAULT_DENSITY },
    resolution: 28,
    threshold: 0,
    wireframe: false,
  },
  csg: {
    shapeA: 'sphere',
    shapeB: 'box',
    op: 'subtract',
    smoothK: 0.25,
    thickness: 0.1,
    wireframe: false,
  },
  meshing: {
    method: 'marching',
    resolution: 28,
    wireframe: false,
  },
  chunking: {
    worldEdge: 256,
    chunkEdge: 32,
    radius: 2,
  },
};

export function mergeStudioConfig(raw: unknown): StudioConfig {
  const base = structuredClone(DEFAULT_STUDIO_CONFIG);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<StudioConfig>;
  return {
    version: 1,
    station: r.station ?? base.station,
    density: { ...base.density, ...r.density, params: { ...base.density.params, ...r.density?.params } },
    csg: { ...base.csg, ...r.csg },
    meshing: { ...base.meshing, ...r.meshing },
    chunking: { ...base.chunking, ...r.chunking },
  };
}
