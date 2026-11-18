import ExperimentPage from './ExperimentPage';

/** The World page is White Jade Island itself (it used to live at #/atlas/wonderland-terrain). */
export const WORLD_ID = 'wonderland-terrain';

export default function World() {
  return <ExperimentPage id={WORLD_ID} />;
}
