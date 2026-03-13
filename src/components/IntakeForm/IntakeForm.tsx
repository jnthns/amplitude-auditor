import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ComplianceChips from './ComplianceChips'
import DataSourceSelector from './DataSourceSelector'
import FileUpload from './FileUpload'
import { parseSchemaFiles } from '../../lib/csvParser'
import { useAuditStore } from '../../store/auditStore'
import type { ComplianceRequirement, DataSource, Industry } from '../../types/audit'

const INDUSTRIES: Industry[] = ['Fintech', 'SaaS', 'E-commerce', 'Media', 'Healthcare', 'Gaming', 'Other']

function IntakeForm() {
  const navigate = useNavigate()
  const setForm = useAuditStore((state) => state.setForm)
  const setParsedSchema = useAuditStore((state) => state.setParsedSchema)
  const resetAll = useAuditStore((state) => state.resetAll)

  const [customerName, setCustomerName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [eventsFile, setEventsFile] = useState<File | null>(null)
  const [userFile, setUserFile] = useState<File | null>(null)
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [industry, setIndustry] = useState<Industry | ''>('')
  const [industryOther, setIndustryOther] = useState('')
  const [compliance, setCompliance] = useState<ComplianceRequirement[]>([])
  const [knownConcerns, setKnownConcerns] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState(() => __GEMINI_API_KEY__.trim())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!customerName.trim()) return setError('Customer name is required.')
    if (!eventsFile) return setError('Events + Event Properties CSV is required.')
    if (dataSources.length === 0) return setError('Select at least one data source.')
    if (!geminiApiKey.trim()) return setError('Gemini API key is required. Set GEMINI_API_KEY in .env.local or enter it here.')

    setLoading(true)
    try {
      resetAll()
      const parsedSchema = await parseSchemaFiles(eventsFile, userFile ?? undefined)
      setForm({
        customerName: customerName.trim(),
        projectId: projectId.trim(),
        industry: industry || undefined,
        industryOther: industry === 'Other' ? industryOther.trim() : undefined,
        dataSources,
        compliance,
        knownConcerns: knownConcerns.trim(),
        geminiApiKey: geminiApiKey.trim(),
      })
      setParsedSchema(parsedSchema)
      navigate('/audit')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to parse CSV files.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Amplitude Taxonomy Audit App</h1>
        <p className="mt-2 text-sm text-slate-600">Upload your schema export, add context, and run a 45-criteria audit.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="input-label">Customer Name *</label>
            <input className="input-base" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div>
            <label className="input-label">Amplitude Project ID</label>
            <input className="input-base" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="123456" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FileUpload
            label="Events + Event Properties CSV"
            required
            file={eventsFile}
            onChange={setEventsFile}
            helperText="Expected required columns include Event Name, Display Name, Description, Category, Status, Volume, Query Count, First Seen, Last Seen. Supports large files up to 75MB."
          />
          <FileUpload
            label="User Properties CSV"
            file={userFile}
            onChange={setUserFile}
            helperText="Optional. Used to improve property-level recommendations. Supports large files up to 75MB."
          />
        </div>

        <DataSourceSelector value={dataSources} onChange={setDataSources} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="input-label">Industry / Vertical</label>
            <select className="input-base" value={industry} onChange={(e) => setIndustry(e.target.value as Industry | '')}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {industry === 'Other' ? (
            <div>
              <label className="input-label">Other Industry</label>
              <input className="input-base" value={industryOther} onChange={(e) => setIndustryOther(e.target.value)} placeholder="Describe industry" />
            </div>
          ) : null}
        </div>

        <ComplianceChips value={compliance} onChange={setCompliance} />

        <div>
          <label className="input-label">Known Concerns</label>
          <textarea
            className="input-base min-h-24"
            value={knownConcerns}
            onChange={(event) => setKnownConcerns(event.target.value)}
            placeholder="Any schema concerns or context to account for..."
          />
        </div>

        <div>
          <label className="input-label">Gemini API Key *</label>
          <input
            type="password"
            className="input-base"
            value={geminiApiKey}
            onChange={(event) => setGeminiApiKey(event.target.value)}
            placeholder="AIza..."
          />
          <p className="mt-1 text-xs text-slate-500">Defaults from `GEMINI_API_KEY` in `.env.local` for local testing, or enter manually for this session.</p>
        </div>

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="flex justify-end">
          <button type="submit" className="rounded-lg bg-arctic-600 px-4 py-2 text-sm font-semibold text-white hover:bg-arctic-700 disabled:opacity-60" disabled={loading}>
            {loading ? 'Parsing CSV...' : 'Start Audit'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default IntakeForm
