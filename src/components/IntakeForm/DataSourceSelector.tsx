import type { DataSource } from '../../types/audit'

const SOURCES: DataSource[] = [
  'Segment',
  'Other CDP',
  'Warehouse',
  'APIs',
  'Amplitude SDK',
  'Google Tag Manager',
  'CDP / Reverse ETL',
]

interface DataSourceSelectorProps {
  value: DataSource[]
  onChange: (sources: DataSource[]) => void
}

function DataSourceSelector({ value, onChange }: DataSourceSelectorProps) {
  return (
    <div>
      <label className="input-label">Primary Data Source(s) *</label>
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((source) => {
          const selected = value.includes(source)
          return (
            <button
              key={source}
              type="button"
              className={`chip ${selected ? 'chip-on' : 'chip-off'}`}
              onClick={() => {
                onChange(selected ? value.filter((item) => item !== source) : [...value, source])
              }}
            >
              {source}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DataSourceSelector
