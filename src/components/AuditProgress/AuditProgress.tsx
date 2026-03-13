import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AreaCard from './AreaCard'
import ProgressBar from './ProgressBar'
import { runAudit } from '../../lib/auditEngine'
import { useAuditStore } from '../../store/auditStore'

function AuditProgress() {
  const navigate = useNavigate()
  const startedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const form = useAuditStore((state) => state.form)
  const parsedSchema = useAuditStore((state) => state.parsedSchema)
  const status = useAuditStore((state) => state.status)
  const progressDone = useAuditStore((state) => state.progressDone)
  const progressTotal = useAuditStore((state) => state.progressTotal)
  const currentCriterionLabel = useAuditStore((state) => state.currentCriterionLabel)
  const areaProgress = useAuditStore((state) => state.areaProgress)
  const errorMessage = useAuditStore((state) => state.errorMessage)

  const startAudit = useAuditStore((state) => state.startAudit)
  const setCurrentCriterionLabel = useAuditStore((state) => state.setCurrentCriterionLabel)
  const pushAuditResult = useAuditStore((state) => state.pushAuditResult)
  const setExecutiveSummary = useAuditStore((state) => state.setExecutiveSummary)
  const cancelAudit = useAuditStore((state) => state.cancelAudit)
  const setError = useAuditStore((state) => state.setError)

  useEffect(() => {
    if (!form || !parsedSchema) {
      navigate('/', { replace: true })
      return
    }

    if (startedRef.current) {
      return
    }

    startedRef.current = true
    startAudit()

    const controller = new AbortController()
    abortRef.current = controller

    runAudit({
      form,
      parsedSchema,
      signal: controller.signal,
      onStatus: (message) => setCurrentCriterionLabel(message),
      onResult: (result) => pushAuditResult(result),
    })
      .then(({ summary }) => {
        setExecutiveSummary(summary)
        navigate('/report', { replace: true })
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          cancelAudit()
          return
        }
        setError(error instanceof Error ? error.message : 'Audit failed due to an unknown error.')
      })

    return () => {
      controller.abort()
    }
  }, [
    form,
    parsedSchema,
    navigate,
    startAudit,
    setCurrentCriterionLabel,
    pushAuditResult,
    setExecutiveSummary,
    cancelAudit,
    setError,
  ])

  const statusTone = useMemo(() => {
    if (status === 'error') return 'text-rose-700'
    if (status === 'cancelled') return 'text-amber-700'
    return 'text-slate-700'
  }, [status])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Running Audit</h1>
          <p className={`mt-1 text-sm ${statusTone}`}>{currentCriterionLabel}</p>
          {errorMessage ? <p className="mt-2 text-sm text-rose-700">{errorMessage}</p> : null}
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            abortRef.current?.abort()
            cancelAudit()
          }}
          disabled={status !== 'running'}
        >
          Cancel
        </button>
      </div>

      <div className="card p-5">
        <ProgressBar done={progressDone} total={progressTotal} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {areaProgress.map((area) => (
          <AreaCard key={area.area} area={area} />
        ))}
      </div>
    </main>
  )
}

export default AuditProgress
