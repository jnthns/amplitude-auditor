import type { AreaProgress } from '../../types/audit'

interface AreaCardProps {
  area: AreaProgress
}

function AreaCard({ area }: AreaCardProps) {
  const percent = area.scorePossible > 0 ? Math.round((area.scoreEarned / area.scorePossible) * 100) : 0
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-slate-900">{area.area}</p>
      <p className="mt-1 text-xs text-slate-500">
        {area.criteriaDone}/{area.criteriaTotal} criteria
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Pass {area.pass}</span>
        <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">Fail {area.fail}</span>
        <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">N/A {area.na}</span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-700">Running score: {percent}%</p>
    </div>
  )
}

export default AreaCard
