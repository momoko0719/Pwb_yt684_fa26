import { createContext, useContext } from 'react';

/**
 * Exhibit pages (an experiment whose meta has `exhibit: true`) show the work with its own small
 * interface; the full leva panel is the author's studio, hidden until asked for (the ` key, or the
 * exhibit's own "studio" link). Other experiments always show the panel.
 */
export interface Studio {
  exhibit: boolean;
  studio: boolean;
  setStudio: (on: boolean) => void;
}
export const StudioContext = createContext<Studio>({ exhibit: false, studio: true, setStudio: () => {} });
export const useStudio = () => useContext(StudioContext);
