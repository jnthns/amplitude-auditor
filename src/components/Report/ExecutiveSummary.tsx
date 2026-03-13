import Badge from '../shared/Badge'
import type { ExecSummary, FormState } from '../../types/audit'

interface ExecutiveSummaryProps {
  summary: ExecSummary
  form: FormState
}

function FixList({ title, fixes }: { title: string; fixes: ExecSummary['shortTermFixes'] }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="space-y-3">
        {fixes.length === 0 ? <p className="text-sm text-slate-500">No items generated.</p> : null}
        {fixes.map((fix) => (
          <article key={`${title}-${fix.title}`} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">{fix.title}</p>
            <p className="mt-1 text-sm text-slate-700">{fix.issue}</p>
            <p className="mt-1 text-xs text-slate-500">Impact: {fix.impact}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {fix.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-arctic-800">
              {fix.amplitudeFeature} ({fix.actIds.join(', ')})
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ExecutiveSummary({ summary, form }: ExecutiveSummaryProps) {
  const pct = summary.overallScore.percentage
  const tone = pct >= 85 ? 'success' : pct >= 65 ? 'info' : 'warning'

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{form.customerName}</h2>
            <p className="text-sm text-slate-600">Project ID: {form.projectId || 'N/A'} | Date: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <Badge label={summary.overallScore.grade} tone={tone} />
            <p className="mt-1 text-sm text-slate-700">
              {summary.overallScore.earned}/{summary.overallScore.possible} ({summary.overallScore.percentage}%)
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Top Takeaways</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {summary.topTakeaways.map((takeaway) => (
            <li key={takeaway}>{takeaway}</li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <FixList title="Short-Term Fixes" fixes={summary.shortTermFixes} />
        <FixList title="Medium-Term Fixes" fixes={summary.mediumTermFixes} />
        <FixList title="Long-Term Fixes" fixes={summary.longTermFixes} />
      </div>
    </div>
  )
}

export default ExecutiveSummary
