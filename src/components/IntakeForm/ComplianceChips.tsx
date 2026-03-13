import type { ComplianceRequirement } from '../../types/audit'

const OPTIONS: ComplianceRequirement[] = ['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS', 'CCPA', 'None']

interface ComplianceChipsProps {
  value: ComplianceRequirement[]
  onChange: (requirements: ComplianceRequirement[]) => void
}

function ComplianceChips({ value, onChange }: ComplianceChipsProps) {
  return (
    <div>
      <label className="input-label">Compliance Requirements</label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const selected = value.includes(option)
          return (
            <button
              key={option}
              type="button"
              className={`chip ${selected ? 'chip-on' : 'chip-off'}`}
              onClick={() => {
                if (option === 'None') {
                  onChange(selected ? [] : ['None'])
                  return
                }
                const next = selected ? value.filter((item) => item !== option) : [...value.filter((item) => item !== 'None'), option]
                onChange(next)
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ComplianceChips
