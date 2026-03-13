
import { GoogleGenAI } from '@google/genai'
import type { AuditCriterion, AuditResult, ExecSummary, FormState, ParsedSchema } from '../types/audit'

const MODEL = 'gemini-3-flash-preview'
const MAX_RETRIES = 5
const MIN_INTERVAL_MS = 1100

let requestQueue: Promise<void> = Promise.resolve()
let nextAllowedRequestAt = 0

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitWithAbort(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return
  if (!signal) {
    await wait(ms)
    return
  }
  await Promise.race([
    wait(ms),
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true })
    }),
  ])
}

async function enqueueRateLimited<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const run = async () => {
    if (signal?.aborted) {
      throw new Error('Request aborted')
    }

    const delay = Math.max(0, nextAllowedRequestAt - Date.now())
    await waitWithAbort(delay, signal)
    nextAllowedRequestAt = Date.now() + MIN_INTERVAL_MS
    return fn()
  }

  const task = requestQueue.then(run, run)
  requestQueue = task.then(
    () => undefined,
    () => undefined,
  )

  return task
}

function extractStatusCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const maybeStatus = (error as { status?: unknown }).status
    if (typeof maybeStatus === 'number') {
      return maybeStatus
    }
  }

  const match = String(error).match(/(?:^|\D)(4\d\d|5\d\d)(?:\D|$)/)
  return match ? Number(match[1]) : null
}

function isRetryableError(error: unknown): boolean {
  const status = extractStatusCode(error)
  return status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504
}

function backoffMs(attempt: number) {
  const base = 400 * 2 ** (attempt - 1)
  const jitter = Math.floor(Math.random() * 300)
  return Math.min(8000, base + jitter)
}

function extractJsonObject(raw: string): string {
  const stripped = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const objectStart = stripped.indexOf('{')
  const arrayStart = stripped.indexOf('[')
  const start = objectStart === -1 ? arrayStart : arrayStart === -1 ? objectStart : Math.min(objectStart, arrayStart)

  if (start === -1) {
    throw new Error('Gemini response did not contain valid JSON.')
  }

  return stripped.slice(start)
}

function buildSystemPrompt(form: FormState): string {
  const industry = form.industry === 'Other' ? form.industryOther ?? 'Other' : form.industry ?? 'Unknown'
  return `You are an Amplitude taxonomy audit agent. You evaluate Amplitude schema exports against a structured set of audit criteria and produce detailed, customer-facing findings.

## Rules
- Cite specific event and property names from the data; never use placeholders.
- Write in direct consultant tone.
- Structure every Fail finding as Finding -> Evidence -> Resolution.
- Tailor resolution steps to the customer's data source(s): ${form.dataSources.join(', ')}.
- Score: Pass = full points, Fail = 0, N/A = excluded from denominator.
- Output valid JSON only.

## Customer Context
- Customer: ${form.customerName}
- Industry: ${industry}
- Data Sources: ${form.dataSources.join(', ')}
- Compliance: ${form.compliance.join(', ') || 'None'}
- Known Concerns: ${form.knownConcerns || 'None provided'}
`
}

async function callGeminiJson<T>(params: {
  apiKey: string
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}): Promise<T> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey })

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      if (params.signal?.aborted) {
        throw new Error('Request aborted')
      }

      const response = await enqueueRateLimited(
        () =>
          ai.models.generateContent({
            model: MODEL,
            contents: [
              {
                role: 'user',
                parts: [{ text: `${params.systemPrompt}

${params.userPrompt}` }],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        params.signal,
      )

      const text = response.text ?? ''
      if (!text.trim()) {
        throw new Error('Gemini returned an empty response body.')
      }

      const jsonText = extractJsonObject(text)
      return JSON.parse(jsonText) as T
    } catch (error) {
      lastError = error

      if (params.signal?.aborted) {
        throw new Error('Request aborted')
      }

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        await waitWithAbort(backoffMs(attempt), params.signal)
        continue
      }

      if (attempt < MAX_RETRIES) {
        await waitWithAbort(250, params.signal)
      }
    }
  }

  throw new Error(`Gemini request failed: ${String(lastError)}`)
}

export async function evaluateAreaBatch(params: {
  apiKey: string
  form: FormState
  parsedSchema: ParsedSchema
  areaName: string
  criteria: AuditCriterion[]
  signal?: AbortSignal
}): Promise<Array<Pick<AuditResult, 'criteriaId' | 'score' | 'comments' | 'remediation' | 'amplitudeActions' | 'pointsEarned' | 'pointsPossible' | 'priorityRank'>>> {
  const schemaProjection = {
    stats: params.parsedSchema.stats,
    events: params.parsedSchema.events.slice(0, 200).map((event) => ({
      eventName: event.eventName,
      displayName: event.displayName,
      status: event.status,
      volume: event.volume,
      queryCount: event.queryCount,
      propertyNames: event.properties.map((property) => property.propertyName),
    })),
    userProperties: params.parsedSchema.userProperties.map((property) => property.propertyName),
  }

  const prompt = `Evaluate the following ${params.areaName} criteria against the provided schema data.

## Schema Data
${JSON.stringify(schemaProjection)}

## Criteria to Evaluate
${JSON.stringify(params.criteria)}

Return JSON array:
[
  {
    "criteriaId": "NS-001",
    "score": "Pass" | "Fail" | "N/A",
    "comments": "...",
    "remediation": "..." or null,
    "amplitudeActions": ["ACT-004"] or [],
    "pointsEarned": 1,
    "pointsPossible": 1,
    "priorityRank": null or number
  }
]`

  return callGeminiJson({
    apiKey: params.apiKey,
    systemPrompt: buildSystemPrompt(params.form),
    userPrompt: prompt,
    signal: params.signal,
  })
}

export async function generateExecutiveSummary(params: {
  apiKey: string
  form: FormState
  results: AuditResult[]
  actionsReference: string
  signal?: AbortSignal
}): Promise<ExecSummary> {
  const prompt = `Based on the completed audit results below, generate an executive summary.

## Completed Audit Results
${JSON.stringify(params.results)}

## Amplitude Actions Catalogue
${params.actionsReference}

Return JSON:
{
  "overallScore": { "earned": 0, "possible": 0, "percentage": 0, "grade": "Needs Improvement" },
  "topTakeaways": ["..."],
  "shortTermFixes": [{ "title": "...", "issue": "...", "impact": "...", "steps": ["..."], "amplitudeFeature": "...", "actIds": ["ACT-001"] }],
  "mediumTermFixes": [],
  "longTermFixes": []
}`

  return callGeminiJson({
    apiKey: params.apiKey,
    systemPrompt: buildSystemPrompt(params.form),
    userPrompt: prompt,
    signal: params.signal,
  })
}
