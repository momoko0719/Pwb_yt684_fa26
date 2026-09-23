import {
  createContext, useContext, useState, useCallback, type ReactNode,
} from 'react';
import {
  DEFAULT_STUDIO_CONFIG, mergeStudioConfig, type StudioConfig, type StationId,
} from '../lib/studioConfig';

interface StudioCtx {
  config: StudioConfig;
  setConfig: (c: StudioConfig) => void;
  patch: (partial: Partial<StudioConfig>) => void;
  setStation: (s: StationId) => void;
  applyLoaded: (raw: unknown) => void;
}

const Ctx = createContext<StudioCtx | null>(null);

export function StudioConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);

  const patch = useCallback((partial: Partial<StudioConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...partial,
      density: partial.density ? { ...prev.density, ...partial.density, params: { ...prev.density.params, ...partial.density.params } } : prev.density,
      csg: partial.csg ? { ...prev.csg, ...partial.csg } : prev.csg,
      meshing: partial.meshing ? { ...prev.meshing, ...partial.meshing } : prev.meshing,
      chunking: partial.chunking ? { ...prev.chunking, ...partial.chunking } : prev.chunking,
    }));
  }, []);

  const setStation = useCallback((station: StationId) => {
    setConfig(prev => ({ ...prev, station }));
  }, []);

  const applyLoaded = useCallback((raw: unknown) => {
    setConfig(mergeStudioConfig(raw));
  }, []);

  return (
    <Ctx.Provider value={{ config, setConfig, patch, setStation, applyLoaded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStudioConfig(): StudioCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStudioConfig outside provider');
  return ctx;
}
