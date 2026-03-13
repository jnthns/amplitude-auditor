import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import AuditResultsTable from './AuditResultsTable'
import ExecutiveSummary from './ExecutiveSummary'
import RemediationPlan from './RemediationPlan'
import ScoringOverview from './ScoringOverview'
import ExportButton from '../shared/ExportButton'
import { useAuditStore } from '../../store/auditStore'

type TabId = 'summary' | 'results' | 'remediation' | 'scoring'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'summary', label: 'Executive Summary' },
  { id: 'results', label: 'Audit Results' },
  { id: 'remediation', label: 'Remediation Plan' },
  { id: 'scoring', label: 'Scoring Overview' },
]

function ReportLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  const form = useAuditStore((state) => state.form)
  const parsedSchema = useAuditStore((state) => state.parsedSchema)
  const results = useAuditStore((state) => state.results)
  const summary = useAuditStore((state) => state.executiveSummary)

  const canRender = useMemo(() => Boolean(form && parsedSchema && summary && results.length > 0), [form, parsedSchema, summary, results.length])

  if (!canRender || !form || !parsedSchema || !summary) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit Report</h1>
          <p className="mt-1 text-sm text-slate-600">Interactive audit output with editable execution columns and export.</p>
        </div>
        <ExportButton
          customerName={form.customerName}
          projectId={form.projectId}
          summary={summary}
          results={results}
          schema={parsedSchema}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              activeTab === tab.id ? 'border-arctic-500 bg-arctic-100 text-arctic-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' ? <ExecutiveSummary summary={summary} form={form} /> : null}
      {activeTab === 'results' ? <AuditResultsTable /> : null}
      {activeTab === 'remediation' ? <RemediationPlan /> : null}
      {activeTab === 'scoring' ? <ScoringOverview /> : null}
    </main>
  )
}

export default ReportLayout
