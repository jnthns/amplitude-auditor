import { GRADE_THRESHOLDS } from '../config/scoringLegend'
import type { AreaScore, AuditResult, ParsedEvent, ParsedProperty, ParsedSchemaStats } from '../types/audit'

const PII_HINTS = ['email', 'phone', 'address', 'ssn', 'dob', 'birth', 'credit', 'card', 'token']

export function detectNamingConvention(value: string): string {
  if (/^[A-Z][A-Za-z0-9]*(\s[A-Z][A-Za-z0-9]*)+$/.test(value)) return 'Title Case'
  if (/^[a-z]+(_[a-z0-9]+)+$/.test(value)) return 'snake_case'
  if (/^[a-z][a-zA-Z0-9]+$/.test(value) && /[A-Z]/.test(value)) return 'camelCase'
  if (/^[A-Z]+(_[A-Z0-9]+)+$/.test(value)) return 'SCREAMING_SNAKE'
  return 'Other'
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

export function computeSchemaStats(events: ParsedEvent[], userProperties: ParsedProperty[]): ParsedSchemaStats {
  const eventStatusCounts: Record<string, number> = {}
  const namingConventionCounts: Record<string, number> = {}
  const propertyNameCounts: Record<string, number> = {}

  let zeroQueryEventCount = 0
  let zeroPropertyEventCount = 0

  for (const event of events) {
    const status = (event.status ?? 'UNKNOWN').toUpperCase()
    eventStatusCounts[status] = (eventStatusCounts[status] ?? 0) + 1

    const convention = detectNamingConvention(event.eventName)
    namingConventionCounts[convention] = (namingConventionCounts[convention] ?? 0) + 1

    if ((event.queryCount ?? 0) <= 0) zeroQueryEventCount += 1
    if (event.properties.length === 0) zeroPropertyEventCount += 1

    for (const property of event.properties) {
      const normalized = normalizeName(property.propertyName)
      propertyNameCounts[normalized] = (propertyNameCounts[normalized] ?? 0) + 1
      const propertyConvention = detectNamingConvention(property.propertyName)
      namingConventionCounts[propertyConvention] = (namingConventionCounts[propertyConvention] ?? 0) + 1
    }
  }

  for (const property of userProperties) {
    const normalized = normalizeName(property.propertyName)
    propertyNameCounts[normalized] = (propertyNameCounts[normalized] ?? 0) + 1
    const propertyConvention = detectNamingConvention(property.propertyName)
    namingConventionCounts[propertyConvention] = (namingConventionCounts[propertyConvention] ?? 0) + 1
  }

  const allPropertyNames = [
    ...events.flatMap((event) => event.properties.map((property) => property.propertyName)),
    ...userProperties.map((property) => property.propertyName),
  ]

  const likelyPiiProperties = allPropertyNames.filter((name) => {
    const lowered = normalizeName(name)
    return PII_HINTS.some((hint) => lowered.includes(hint))
  })

  const duplicatePropertyNames = Object.entries(propertyNameCounts)
    .filter(([, count]) => count > 1)
    .map(([name]) => name)

  const topEventsByVolume = [...events]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 10)
    .map((event) => ({
      eventName: event.eventName,
      volume: event.volume ?? 0,
    }))

  const totalProperties = events.reduce((sum, event) => sum + event.properties.length, 0)

  return {
    eventCount: events.length,
    userPropertyCount: userProperties.length,
    eventStatusCounts,
    namingConventionCounts,
    averagePropertiesPerEvent: events.length > 0 ? totalProperties / events.length : 0,
    zeroQueryEventCount,
    zeroPropertyEventCount,
    likelyPiiProperties: Array.from(new Set(likelyPiiProperties)).sort(),
    duplicatePropertyNames,
    topEventsByVolume,
  }
}

export function calculateOverallScore(results: AuditResult[]) {
  let earned = 0
  let possible = 0

  for (const result of results) {
    earned += result.pointsEarned
    if (result.score !== 'N/A') {
      possible += result.pointsPossible
    }
  }

  const percentage = possible > 0 ? Math.round((earned / possible) * 100) : 0
  const grade = GRADE_THRESHOLDS.find((threshold) => percentage >= threshold.minPercent)?.label ?? 'Needs Improvement'

  return { earned, possible, percentage, grade }
}

export function calculateAreaScores(results: AuditResult[]): AreaScore[] {
  const map = new Map<string, AreaScore>()

  for (const result of results) {
    const current = map.get(result.area) ?? {
      area: result.area,
      earned: 0,
      possible: 0,
      percentage: 0,
      passCount: 0,
      failCount: 0,
      naCount: 0,
      topFail: undefined,
    }

    current.earned += result.pointsEarned
    if (result.score !== 'N/A') {
      current.possible += result.pointsPossible
    }

    if (result.score === 'Pass') current.passCount += 1
    if (result.score === 'Fail') {
      current.failCount += 1
      if (!current.topFail) {
        current.topFail = result.topic
      }
    }
    if (result.score === 'N/A') current.naCount += 1

    map.set(result.area, current)
  }

  return Array.from(map.values()).map((score) => ({
    ...score,
    percentage: score.possible > 0 ? Math.round((score.earned / score.possible) * 100) : 0,
  }))
}
