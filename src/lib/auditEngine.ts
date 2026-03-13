import { AMPLITUDE_ACTIONS } from '../config/amplitudeActions'
import { AUDIT_CRITERIA_BY_AREA } from '../config/auditCriteria'
import { calculateOverallScore } from './scoring'
import { evaluateAreaBatch, generateExecutiveSummary } from './claude'
import type { AuditResult, FormState, ParsedSchema } from '../types/audit'

interface RunAuditParams {
  form: FormState
  parsedSchema: ParsedSchema
  onStatus: (message: string) => void
  onResult: (result: AuditResult) => void
  signal?: AbortSignal
}

const SCORE_VALUES = ['Pass', 'Fail', 'N/A'] as const

function safeScore(score: string): 'Pass' | 'Fail' | 'N/A' {
  return (SCORE_VALUES as readonly string[]).includes(score) ? (score as 'Pass' | 'Fail' | 'N/A') : 'N/A'
}

function resultWithMeta(result: Partial<AuditResult>, template: { area: string; impact: AuditResult['impact']; topic: string; pointsPossible: number; criteriaId: string }): AuditResult {
  const score = safeScore(result.score ?? 'N/A')
  return {
    criteriaId: template.criteriaId,
    area: template.area,
    impact: template.impact,
    topic: template.topic,
    score,
    comments: result.comments ?? 'No details returned by model.',
    remediation: result.remediation ?? null,
    amplitudeActions: result.amplitudeActions ?? [],
    pointsEarned: score === 'Pass' ? template.pointsPossible : 0,
    pointsPossible: template.pointsPossible,
    priorityRank: result.priorityRank ?? null,
    branchName: '',
    changeStatus: 'Pending',
    customerSignOff: false,
  }
}

export async function runAudit(params: RunAuditParams): Promise<{ results: AuditResult[]; summary: Awaited<ReturnType<typeof generateExecutiveSummary>> }> {
  const results: AuditResult[] = []
  const areas = Object.keys(AUDIT_CRITERIA_BY_AREA)

  for (const areaName of areas) {
    if (params.signal?.aborted) {
      throw new Error('Audit cancelled')
    }

    const criteria = AUDIT_CRITERIA_BY_AREA[areaName]
    params.onStatus(`Evaluating ${areaName} (${criteria.length} criteria)...`)

    const batch = await evaluateAreaBatch({
      apiKey: params.form.geminiApiKey,
      form: params.form,
      parsedSchema: params.parsedSchema,
      areaName,
      criteria,
      signal: params.signal,
    })

    for (const criterion of criteria) {
      const batchMatch = batch.find((row) => row.criteriaId === criterion.id)
      const withMeta = resultWithMeta(batchMatch ?? {}, {
        criteriaId: criterion.id,
        area: criterion.area,
        impact: criterion.impact,
        topic: criterion.topic,
        pointsPossible: criterion.pointsPossible,
      })
      results.push(withMeta)
      params.onResult(withMeta)
      params.onStatus(`Evaluated ${criterion.id} - ${criterion.topic}`)
    }
  }

  const summary = await generateExecutiveSummary({
    apiKey: params.form.geminiApiKey,
    form: params.form,
    results,
    actionsReference: JSON.stringify(AMPLITUDE_ACTIONS),
    signal: params.signal,
  }).catch(() => {
    const fallbackScore = calculateOverallScore(results)
    return {
      overallScore: fallbackScore,
      topTakeaways: [
        'Prioritize high-impact failed criteria first to improve score quickly.',
        'Adopt governance controls to reduce schema drift and unexpected events.',
        'Improve metadata quality to increase trust in downstream analysis.',
      ],
      shortTermFixes: [],
      mediumTermFixes: [],
      longTermFixes: [],
    }
  })

  return { results, summary }
}
