import { useMemo } from 'react'
import { useAuditStore } from '../../store/auditStore'
import type { AuditResult } from '../../types/audit'

type Tier = 'Immediate' | 'Short-term' | 'Medium-term' | 'Long-term'

function bucket(result: AuditResult): Tier {
  if (result.impact === 'High' && (result.priorityRank ?? 99) <= 15) return 'Immediate'
  if (result.impact === 'High') return 'Short-term'
  if (result.impact === 'Medium') return 'Medium-term'
  return 'Long-term'
}

function RemediationPlan() {
  const failedResults = useAuditStore((state) => state.results.filter((result) => result.score === 'Fail'))

  const grouped = useMemo(() => {
    const initial: Record<Tier, AuditResult[]> = {
      Immediate: [],
      'Short-term': [],
      'Medium-term': [],
      'Long-term': [],
    }

    for (const result of failedResults) {
      initial[bucket(result)].push(result)
    }

    return initial
  }, [failedResults])

  return (
    <div className="space-y-4">
      {(Object.keys(grouped) as Tier[]).map((tier) => (
        <section key={tier} className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900">{tier}</h3>
          <div className="mt-3 space-y-3">
            {grouped[tier].length === 0 ? <p className="text-sm text-slate-500">No items in this tier.</p> : null}
            {grouped[tier].map((item) => (
              <article key={`${tier}-${item.criteriaId}`} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.criteriaId} - {item.topic}
                </p>
                <p className="mt-1 text-sm text-slate-700">{item.comments}</p>
                {item.remediation ? <p className="mt-1 text-sm text-slate-700">{item.remediation}</p> : null}
                <p className="mt-2 text-xs text-arctic-700">Actions: {item.amplitudeActions.join(', ') || 'None'}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default RemediationPlan
