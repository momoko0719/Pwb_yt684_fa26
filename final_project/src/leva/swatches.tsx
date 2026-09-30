import { Components, createPlugin, useInputContext, useValue } from 'leva/plugin';
import { UI } from '../core/palette';

const { Row, Label } = Components;

interface SwatchOption {
  value: string;
  label: string;
}

interface SwatchesInput {
  /** Named `selected`, not `value`: leva keeps only `.value` and would drop the rest. */
  selected: string;
  options: SwatchOption[];
  /** Colors shown for an option; `watched` is the current value at `watch`. */
  colors: (value: string, watched: unknown) => string[];
  /** Another control whose value the colors depend on, e.g. the hour. */
  watch: string;
}
type SwatchesSettings = Omit<SwatchesInput, 'selected'>;

function Swatches() {
  const { label, value, onUpdate, settings } = useInputContext<{ value: string; settings: SwatchesSettings; onUpdate: (v: string) => void }>();
  const watched = useValue(settings.watch);
  return (
    <Row>
      <Label>{label}</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
        {settings.options.map((option) => (
          <button key={option.value} type="button" onClick={() => onUpdate(option.value)} title={option.label}
            style={{
              padding: 3,
              background: 'none',
              border: `1px solid ${option.value === value ? UI.accent : UI.line}`,
              cursor: 'pointer',
            }}>
            <div style={{ display: 'flex', height: 14 }}>
              {settings.colors(option.value, watched).map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
            </div>
            <div style={{ color: option.value === value ? UI.text : UI.textDim, fontSize: 10, marginTop: 2 }}>{option.label}</div>
          </button>
        ))}
      </div>
    </Row>
  );
}

/** A choice between named color sets, each shown as a strip of its colors. */
export const swatches = createPlugin<SwatchesInput, string, SwatchesSettings>({
  component: Swatches,
  normalize: ({ selected, ...settings }) => ({ value: selected, settings }),
  sanitize: (v: string, settings: SwatchesSettings) => {
    if (!settings.options.some((o) => o.value === v)) throw new Error(`Unknown option ${v}`);
    return v;
  },
});
