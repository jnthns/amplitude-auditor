import { create } from 'zustand'
import { AUDIT_AREAS, AUDIT_CRITERIA_BY_AREA } from '../config/auditCriteria'
import type { AreaProgress, AuditResult, AuditStatus, ExecSummary, FormState, ParsedSchema } from '../types/audit'

interface AuditStoreState {
  form: FormState | null
  parsedSchema: ParsedSchema | null
  status: AuditStatus
  currentCriterionLabel: string
  progressDone: number
  progressTotal: number
  areaProgress: AreaProgress[]
  results: AuditResult[]
  executiveSummary: ExecSummary | null
  errorMessage: string | null
  setForm: (form: FormState) => void
  setParsedSchema: (schema: ParsedSchema) => void
  startAudit: () => void
  setCurrentCriterionLabel: (label: string) => void
  pushAuditResult: (result: AuditResult) => void
  setExecutiveSummary: (summary: ExecSummary) => void
  cancelAudit: () => void
  setError: (message: string) => void
  resetAll: () => void
  updateResultMeta: (criteriaId: string, patch: Partial<Pick<AuditResult, 'branchName' | 'changeStatus' | 'customerSignOff'>>) => void
}

function buildAreaProgress(): AreaProgress[] {
  return AUDIT_AREAS.map((area) => ({
    area,
    criteriaTotal: AUDIT_CRITERIA_BY_AREA[area]?.length ?? 0,
    criteriaDone: 0,
    pass: 0,
    fail: 0,
    na: 0,
    scoreEarned: 0,
    scorePossible: 0,
  }))
}

export const useAuditStore = create<AuditStoreState>((set, get) => ({
  form: null,
  parsedSchema: null,
  status: 'idle',
  currentCriterionLabel: 'Waiting to start audit...',
  progressDone: 0,
  progressTotal: 45,
  areaProgress: buildAreaProgress(),
  results: [],
  executiveSummary: null,
  errorMessage: null,
  setForm: (form) => set({ form }),
  setParsedSchema: (parsedSchema) => set({ parsedSchema }),
  startAudit: () =>
    set({
      status: 'running',
      currentCriterionLabel: 'Preparing audit batches...',
      progressDone: 0,
      progressTotal: 45,
      results: [],
      executiveSummary: null,
      errorMessage: null,
      areaProgress: buildAreaProgress(),
    }),
  setCurrentCriterionLabel: (label) => set({ currentCriterionLabel: label }),
  pushAuditResult: (result) => {
    const nextResults = [...get().results, result]
    const areaProgress = get().areaProgress.map((area) => {
      if (area.area !== result.area) {
        return area
      }
      return {
        ...area,
        criteriaDone: area.criteriaDone + 1,
        pass: area.pass + (result.score === 'Pass' ? 1 : 0),
        fail: area.fail + (result.score === 'Fail' ? 1 : 0),
        na: area.na + (result.score === 'N/A' ? 1 : 0),
        scoreEarned: area.scoreEarned + result.pointsEarned,
        scorePossible: area.scorePossible + result.pointsPossible,
      }
    })

    set({
      results: nextResults,
      progressDone: nextResults.length,
      areaProgress,
    })
  },
  setExecutiveSummary: (executiveSummary) => set({ executiveSummary, status: 'complete' }),
  cancelAudit: () => set({ status: 'cancelled', currentCriterionLabel: 'Audit cancelled by user.' }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  resetAll: () =>
    set({
      form: null,
      parsedSchema: null,
      status: 'idle',
      currentCriterionLabel: 'Waiting to start audit...',
      progressDone: 0,
      progressTotal: 45,
      areaProgress: buildAreaProgress(),
      results: [],
      executiveSummary: null,
      errorMessage: null,
    }),
  updateResultMeta: (criteriaId, patch) => {
    const updated = get().results.map((result) =>
      result.criteriaId === criteriaId
        ? {
            ...result,
            ...patch,
          }
        : result,
    )
    set({ results: updated })
  },
}))
