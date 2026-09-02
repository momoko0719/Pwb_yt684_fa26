interface SliderRowProps {
  label: string
  min: number
  max: number
  defaultValue: number
  unit?: string
  step?: number
}

function SliderRow({ label, min, max, defaultValue, unit = '', step = 1 }: SliderRowProps) {
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{defaultValue}{unit}</span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
      />
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="sidebar-section">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <Section title="Geometry">
          <SliderRow label="Size" min={0} max={100} defaultValue={50} unit="%" />
          <SliderRow label="Segments" min={1} max={32} defaultValue={1} />
        </Section>

        <Section title="Material">
          <SliderRow label="Roughness" min={0} max={100} defaultValue={25} unit="%" step={1} />
          <SliderRow label="Metalness" min={0} max={100} defaultValue={45} unit="%" step={1} />
        </Section>

        <Section title="Animation">
          <SliderRow label="Speed X" min={0} max={100} defaultValue={30} unit="%" />
          <SliderRow label="Speed Y" min={0} max={100} defaultValue={50} unit="%" />
        </Section>

        <Section title="Lighting">
          <SliderRow label="Ambient" min={0} max={100} defaultValue={35} unit="%" />
          <SliderRow label="Directional" min={0} max={100} defaultValue={70} unit="%" />
        </Section>
      </div>
    </aside>
  )
}
