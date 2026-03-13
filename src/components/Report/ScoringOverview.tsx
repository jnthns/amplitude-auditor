import { calculateAreaScores } from '../../lib/scoring'
import { useAuditStore } from '../../store/auditStore'
import RadarChart from './RadarChart'

function ScoringOverview() {
  const results = useAuditStore((state) => state.results)
  const summary = useAuditStore((state) => state.executiveSummary)
  const areaScores = calculateAreaScores(results)

  if (!summary) {
    return <p className="text-sm text-slate-500">No score data available.</p>
  }

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Area Score Radar</h3>
        <RadarChart areaScores={areaScores} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {areaScores.map((area) => (
          <article key={area.area} className="card p-3">
            <p className="text-sm font-semibold text-slate-900">{area.area}</p>
            <p className="mt-1 text-xs text-slate-600">
              {area.earned}/{area.possible} points ({area.percentage}%)
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Pass {area.passCount} | Fail {area.failCount} | N/A {area.naCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Top fail: {area.topFail ?? 'None'}</p>
          </article>
        ))}
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-semibold text-slate-900">Overall Score</h3>
        <p className="mt-1 text-sm text-slate-700">
          {summary.overallScore.earned}/{summary.overallScore.possible} ({summary.overallScore.percentage}%) - {summary.overallScore.grade}
        </p>
        <div className="mt-3 h-3 w-full rounded-full bg-slate-200">
          <div className="h-3 rounded-full bg-arctic-600" style={{ width: `${summary.overallScore.percentage}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Needs Improvement</span>
          <span>Meets Expectations</span>
          <span>Exceeds Expectations</span>
        </div>
      </section>
    </div>
  )
}

export default ScoringOverview
