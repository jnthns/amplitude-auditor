import { AMPLITUDE_ACTIONS } from '../config/amplitudeActions'
import { AUDIT_CRITERIA } from '../config/auditCriteria'
import { callWithFallback } from './gemini'
import type {
  AmplitudeAction,
  AuditCriterion,
  AuditResult,
  CriterionResult,
  ExecutiveSummary,
  FormState,
  IntakeFormData,
  ParsedEvent,
  ParsedSchema,
  ParsedUserProperty,
  PreProcessedStats,
} from '../types/audit'

interface RunAuditParams {
  form: FormState
  parsedSchema: ParsedSchema
  onStatus: (message: string) => void
  onResult: (result: AuditResult) => void
  signal?: AbortSignal
}

const BATCHES = [
  {
    label: 'Naming, Schema, Governance',
    areas: ['Naming Standards', 'Schema Completeness', 'Governance & Status'],
  },
  {
    label: 'Property, Compliance, Volume',
    areas: ['Property Hygiene', 'PII & Compliance', 'Volume & Usage'],
  },
  {
    label: 'Experiment, Group, Operations',
    areas: ['Experimentation', 'Group Analytics', 'Operational Readiness'],
  },
] as const

function isAbortError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('abort')
}

function toIntakeFormData(form: FormState): IntakeFormData {
  return {
    customerName: form.customerName,
    projectId: form.projectId,
    dataSources: form.dataSources,
    industry: form.industry === 'Other' ? form.industryOther || 'Other' : form.industry || '',
    compliance: form.compliance,
    concerns: form.knownConcerns,
    geminiApiKey: form.geminiApiKey,
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildSystemPrompt(formData: IntakeFormData): string {
  return `You are an Amplitude taxonomy audit agent used by Professional Services.
You evaluate Amplitude schema exports against structured audit criteria
and produce detailed, customer-facing findings.

RULES:
- Cite specific event and property names from the schema data. Never use placeholders like [Example A].
- Informal, direct consultant tone. Use contractions.
- Every Fail finding MUST have three distinct sections separated by \n\n:
  1. Finding: What's wrong and how widespread it is.
  2. Evidence: Specific event/property names and numbers from the schema.
  3. How to Resolve: Numbered steps tailored to the customer's data source(s).
- Tailor all resolution steps to: ${formData.dataSources.join(', ')}.
- Scoring: Pass = full points, Fail = 0 points, N/A = excluded from denominator.
- UNEXPECTED schema status should be explicitly flagged.
- Output ONLY valid JSON. No markdown fences, no preamble, no text outside the JSON.

CUSTOMER CONTEXT:
- Customer: ${formData.customerName}
- Industry: ${formData.industry || 'Not specified'}
- Data Source(s): ${formData.dataSources.join(', ')}
- Compliance: ${formData.compliance.length ? formData.compliance.join(', ') : 'None specified'}
- Known Concerns: ${formData.concerns || 'None'}

SCORING:
- High impact = 3 points
- Medium impact = 2 points
- Low impact = 1 point
- Pass = full points
- Fail = 0 points
- N/A = excluded from denominator`
}

function compressSchema(events: ParsedEvent[], stats: PreProcessedStats): Array<Record<string, unknown>> {
  const piiEventNames = new Set(stats.suspectedPiiEventProperties.map((item) => item.eventName))
  const topVolumeNames = new Set(stats.topEventsByVolume.slice(0, 50).map((item) => item.name))

  return events.map((event) => {
    const needsFullDetail = topVolumeNames.has(event.name) || piiEventNames.has(event.name) || event.properties.length > 20

    return {
      name: event.name,
      displayName: event.displayName,
      schemaStatus: event.schemaStatus,
      activity: event.activity,
      category: event.category,
      description: event.description ? '(has description)' : '',
      volume30d: event.volume30d,
      queries30d: event.queries30d,
      propertyCount: event.properties.length,
      properties: needsFullDetail ? event.properties : undefined,
    }
  })
}

function buildBatchPrompt(batchCriteria: AuditCriterion[], events: ParsedEvent[], userProperties: ParsedUserProperty[], stats: PreProcessedStats): string {
  const schemaJSON = events.length > 500 ? JSON.stringify(compressSchema(events, stats)) : JSON.stringify(events)

  return `Evaluate these audit criteria against the Amplitude schema data.

## Pre-Computed Statistics (deterministic, use as primary evidence)
${JSON.stringify(stats, null, 2)}

## Event Schema (${events.length} active events)
${schemaJSON}

## User Properties (${userProperties.length} properties)
${JSON.stringify(userProperties)}

## Criteria to Evaluate (${batchCriteria.length} criteria)
${JSON.stringify(
  batchCriteria.map((criterion) => ({
    id: criterion.id,
    area: criterion.area,
    impact: criterion.impact,
    topic: criterion.topic,
    description: criterion.description,
    passCondition: criterion.passCriteria,
    failCondition: criterion.failCriteria,
    points: criterion.pointsPossible,
  })),
)}

Return a JSON array with one object per criterion:
[
  {
    "criteriaId": "NS-001",
    "score": "Pass" | "Fail" | "N/A",
    "comments": "Paragraph 1: the finding.\n\nParagraph 2: evidence with specific names.\n\nParagraph 3: How to Resolve with numbered steps.",
    "remediation": "Numbered customer-facing steps. null if Pass.",
    "amplitudeActions": ["ACT-004", "ACT-005"],
    "pointsEarned": 1.0,
    "pointsPossible": 1.0
  }
]

IMPORTANT:
- Use the pre-computed statistics as your primary evidence.
- For each Fail, cite at least 3 specific event or property names as evidence.
- If data is insufficient, score "N/A" and explain what data is missing.
- For criteria that require user properties: if user properties are empty, score "N/A" with note "User properties CSV not provided."
- The remediation field should contain numbered steps specific to the customer's data source(s).`
}

function buildSummaryPrompt(allResults: CriterionResult[], actions: AmplitudeAction[], stats: PreProcessedStats): string {
  return `Generate an executive summary for this completed Amplitude taxonomy audit.

## All Audit Results (${allResults.length} criteria evaluated)
${JSON.stringify(allResults)}

## Amplitude Actions Catalogue
${JSON.stringify(actions)}

## Schema Statistics
${JSON.stringify(stats, null, 2)}

Return a single JSON object:
{
  "overallScore": {
    "earned": <sum of pointsEarned across all results>,
    "possible": <sum of pointsPossible where score !== "N/A">,
    "percentage": <earned / possible * 100 rounded to 1 decimal>,
    "grade": "Needs Improvement" | "Meets Expectations" | "Exceeds Expectations"
  },
  "topTakeaways": ["..."],
  "shortTermFixes": [{ "title": "...", "issue": "...", "impact": "...", "steps": ["..."], "amplitudeFeature": "...", "actIds": ["ACT-001"], "effort": "Low", "criteriaIds": ["NS-001"] }],
  "mediumTermFixes": [],
  "longTermFixes": []
}`
}

function normalizeCriterionResult(row: Partial<CriterionResult>, criterion: AuditCriterion): CriterionResult {
  const score = row.score === 'Pass' || row.score === 'Fail' || row.score === 'N/A' ? row.score : 'N/A'
  return {
    criteriaId: criterion.id,
    score,
    comments: row.comments || 'Not evaluated by model.',
    remediation: row.remediation ?? null,
    amplitudeActions: Array.isArray(row.amplitudeActions) ? row.amplitudeActions : [],
    pointsEarned: score === 'Pass' ? criterion.pointsPossible : 0,
    pointsPossible: criterion.pointsPossible,
  }
}

function toAuditResult(criterion: AuditCriterion, result: CriterionResult): AuditResult {
  return {
    criteriaId: criterion.id,
    area: criterion.area,
    impact: criterion.impact,
    topic: criterion.topic,
    score: result.score,
    comments: result.comments,
    remediation: result.remediation,
    amplitudeActions: result.amplitudeActions,
    pointsEarned: result.pointsEarned,
    pointsPossible: result.pointsPossible,
    priorityRank: null,
    branchName: '',
    changeStatus: 'Pending',
    customerSignOff: false,
  }
}

async function runBatch(
  form: FormState,
  systemPrompt: string,
  batchCriteria: AuditCriterion[],
  events: ParsedEvent[],
  userProperties: ParsedUserProperty[],
  stats: PreProcessedStats,
): Promise<CriterionResult[]> {
  const userPrompt = buildBatchPrompt(batchCriteria, events, userProperties, stats)
  const raw = await callWithFallback(form.geminiApiKey, systemPrompt, userPrompt, 16384)
  if (!Array.isArray(raw)) {
    throw new Error('Batch response was not an array')
  }

  const byId = new Map<string, Partial<CriterionResult>>()
  for (const item of raw as Array<Partial<CriterionResult>>) {
    if (!item?.criteriaId) continue
    byId.set(item.criteriaId, item)
  }

  return batchCriteria.map((criterion) => normalizeCriterionResult(byId.get(criterion.id) || {}, criterion))
}

function fallbackSummary(results: CriterionResult[]): ExecutiveSummary {
  const earned = results.reduce((sum, result) => sum + result.pointsEarned, 0)
  const possible = results.filter((result) => result.score !== 'N/A').reduce((sum, result) => sum + result.pointsPossible, 0)
  const percentage = possible > 0 ? Number(((earned / possible) * 100).toFixed(1)) : 0
  const grade = percentage >= 80 ? 'Exceeds Expectations' : percentage >= 50 ? 'Meets Expectations' : 'Needs Improvement'

  return {
    overallScore: { earned, possible, percentage, grade },
    topTakeaways: [
      'Prioritize high-impact failed criteria first to improve score quickly.',
      'Tighten taxonomy governance to reduce unexpected events and schema drift.',
      'Address documentation and property hygiene gaps to improve analysis trust.',
    ],
    shortTermFixes: [],
    mediumTermFixes: [],
    longTermFixes: [],
  }
}

export async function runAudit(params: RunAuditParams): Promise<{ results: AuditResult[]; summary: ExecutiveSummary }> {
  const formData = toIntakeFormData(params.form)
  const systemPrompt = buildSystemPrompt(formData)

  const criteria = AUDIT_CRITERIA
  const totalCriteria = criteria.length
  const allCriterionResults: CriterionResult[] = []
  const allAuditResults: AuditResult[] = []

  for (const batch of BATCHES) {
    if (params.signal?.aborted) throw new Error('Audit cancelled')

    const batchCriteria = criteria.filter((criterion) => batch.areas.some((area) => area === criterion.area))
    if (!batchCriteria.length) continue

    params.onStatus(`Evaluating ${batch.label} (${batchCriteria.length} criteria)...`)

    const batchResults = await runBatch(
      params.form,
      systemPrompt,
      batchCriteria,
      params.parsedSchema.events,
      params.parsedSchema.userProperties,
      params.parsedSchema.stats as PreProcessedStats,
    )

    for (let i = 0; i < batchCriteria.length; i += 1) {
      const criterion = batchCriteria[i]
      const criterionResult = batchResults[i]
      const auditResult = toAuditResult(criterion, criterionResult)
      allCriterionResults.push(criterionResult)
      allAuditResults.push(auditResult)
      params.onResult(auditResult)
      params.onStatus(`Evaluated ${criterion.id} - ${criterion.topic}`)
    }

    await wait(2000)
  }

  params.onStatus('Generating executive summary...')

  let summary: ExecutiveSummary
  try {
    const summaryPrompt = buildSummaryPrompt(allCriterionResults, AMPLITUDE_ACTIONS, params.parsedSchema.stats as PreProcessedStats)
    const rawSummary = await callWithFallback(params.form.geminiApiKey, systemPrompt, summaryPrompt, 8192)
    summary = rawSummary as ExecutiveSummary
  } catch (error) {
    if (isAbortError(error)) throw error
    summary = fallbackSummary(allCriterionResults)
  }

  if (allAuditResults.length < totalCriteria) {
    console.warn(`Expected ${totalCriteria} criteria results but received ${allAuditResults.length}. Missing rows will be absent from report.`)
  }

  return { results: allAuditResults, summary }
}
