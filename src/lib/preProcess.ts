import type { ParsedEvent, ParsedUserProperty, PreProcessedStats } from '../types/audit'

const PII_PATTERNS: RegExp[] = [
  /email/i, /e[-_]?mail/i,
  /phone/i, /mobile/i, /cell/i,
  /address/i, /street/i, /zip_?code/i, /postal/i,
  /\bssn\b/i, /social_?security/i,
  /passport/i, /driver_?license/i,
  /\bdob\b/i, /date_?of_?birth/i, /birth_?date/i,
  /ip_?address/i,
  /first_?name/i, /last_?name/i, /full_?name/i,
  /credit_?card/i, /card_?number/i, /\bcvv\b/i,
]

export function classifyNaming(name: string): string {
  if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(name)) return 'titleCase'
  if (/^[a-z]+(_[a-z0-9]+)*$/.test(name)) return 'snakeCase'
  if (/^[a-z]+([A-Z][a-z0-9]+)*$/.test(name)) return 'camelCase'
  if (/^[A-Z]+(_[A-Z0-9]+)*$/.test(name)) return 'screamingSnake'
  if (/^[a-z]+(\.[a-z0-9]+)*$/.test(name)) return 'dotCase'
  if (/^[a-z]+(-[a-z0-9]+)*$/.test(name)) return 'kebabCase'
  return 'other'
}

function isPiiCandidate(name: string) {
  return PII_PATTERNS.some((pattern) => pattern.test(name))
}

export function computeStats(events: ParsedEvent[], userProperties: ParsedUserProperty[]): PreProcessedStats {
  const totalEventRows = events.length
  const activeEvents = events.filter((event) => (event.activity || '').toUpperCase() !== 'INACTIVE').length
  const inactiveEvents = totalEventRows - activeEvents

  const eventsBySchemaStatus: Record<string, number> = {}
  for (const event of events) {
    const key = (event.schemaStatus || 'UNKNOWN').toUpperCase()
    eventsBySchemaStatus[key] = (eventsBySchemaStatus[key] ?? 0) + 1
  }

  const namingConventions: Record<string, string[]> = {}
  const namingConventionDistribution: Record<string, number> = {}
  for (const event of events) {
    const convention = classifyNaming(event.name)
    namingConventionDistribution[convention] = (namingConventionDistribution[convention] ?? 0) + 1
    const list = namingConventions[convention] ?? []
    list.push(event.name)
    namingConventions[convention] = list
  }

  const propertyNamingConventions: Record<string, number> = {}
  for (const event of events) {
    for (const property of event.properties) {
      const convention = classifyNaming(property.name)
      propertyNamingConventions[convention] = (propertyNamingConventions[convention] ?? 0) + 1
    }
  }
  for (const property of userProperties) {
    const convention = classifyNaming(property.name)
    propertyNamingConventions[convention] = (propertyNamingConventions[convention] ?? 0) + 1
  }

  const totalVolume30d = events.reduce((sum, event) => sum + (event.volume30d || 0), 0)
  const topEventsByVolume = [...events]
    .sort((a, b) => (b.volume30d || 0) - (a.volume30d || 0))
    .slice(0, 20)
    .map((event) => ({ name: event.name, volume: event.volume30d || 0, queries: event.queries30d || 0 }))

  const zeroQueryEvents = events
    .filter((event) => (event.volume30d || 0) > 0 && (event.queries30d || 0) === 0)
    .map((event) => ({ name: event.name, volume: event.volume30d || 0 }))

  const zeroQueryEventVolume = zeroQueryEvents.reduce((sum, event) => sum + event.volume, 0)

  const eventPropertyCounts = events.map((event) => ({ eventName: event.name, count: event.properties.length }))
  const totalEventProperties = eventPropertyCounts.reduce((sum, item) => sum + item.count, 0)
  const avgPropertiesPerEvent = events.length ? totalEventProperties / events.length : 0
  const maxPropertiesPerEvent = eventPropertyCounts.reduce(
    (max, current) => (current.count > max.count ? current : max),
    { eventName: '', count: 0 },
  )
  const eventsWithOver20Properties = eventPropertyCounts.filter((item) => item.count > 20).map((item) => item.eventName)

  const totalUserProperties = userProperties.length

  const suspectedPiiEventProperties: Array<{ eventName: string; propertyName: string }> = []
  for (const event of events) {
    for (const property of event.properties) {
      if (isPiiCandidate(property.name)) {
        suspectedPiiEventProperties.push({ eventName: event.name, propertyName: property.name })
      }
    }
  }

  const suspectedPiiUserProperties = userProperties.filter((property) => isPiiCandidate(property.name)).map((property) => property.name)

  const eventPropertyNameSet = new Set(events.flatMap((event) => event.properties.map((property) => property.name.toLowerCase())))
  const userPropertyNameSet = new Set(userProperties.map((property) => property.name.toLowerCase()))
  const duplicatePropertyNames = Array.from(eventPropertyNameSet).filter((name) => userPropertyNameSet.has(name))

  const eventsWithoutDescription = events.filter((event) => !event.description?.trim()).length
  const eventsWithDescription = events.length - eventsWithoutDescription
  const eventPropertiesWithoutDescription = events.reduce(
    (count, event) => count + event.properties.filter((property) => !property.description?.trim()).length,
    0,
  )
  const userPropertiesWithoutDescription = userProperties.filter((property) => !property.description?.trim()).length

  const eventsWithCategory = events.filter((event) => !!event.category?.trim()).length
  const eventsWithoutCategory = events.length - eventsWithCategory
  const uniqueCategories = Array.from(new Set(events.map((event) => event.category?.trim()).filter(Boolean) as string[])).sort()

  const screenViewPatterns = events
    .map((event) => event.name)
    .filter((name) => /screen|page|view|viewed|visit/i.test(name))

  const clickPatterns = events
    .map((event) => event.name)
    .filter((name) => /click|tap|press|select|touch/i.test(name))

  const unexpectedEventCount = events.filter((event) => (event.schemaStatus || '').toUpperCase() === 'UNEXPECTED').length
  const unexpectedEventPct = activeEvents > 0 ? (unexpectedEventCount / activeEvents) * 100 : 0
  const unexpectedPropertyCount = events.reduce(
    (count, event) => count + event.properties.filter((property) => (property.schemaStatus || '').toUpperCase() === 'UNEXPECTED').length,
    0,
  )

  return {
    totalEventRows,
    activeEvents,
    inactiveEvents,
    eventsBySchemaStatus,
    namingConventions,
    namingConventionDistribution,
    propertyNamingConventions,
    totalVolume30d,
    topEventsByVolume,
    zeroQueryEvents,
    zeroQueryEventVolume,
    avgPropertiesPerEvent,
    maxPropertiesPerEvent,
    eventsWithOver20Properties,
    totalUserProperties,
    suspectedPiiEventProperties,
    suspectedPiiUserProperties,
    duplicatePropertyNames,
    eventsWithoutDescription,
    eventsWithDescription,
    eventPropertiesWithoutDescription,
    userPropertiesWithoutDescription,
    eventsWithCategory,
    eventsWithoutCategory,
    uniqueCategories,
    screenViewPatterns,
    clickPatterns,
    unexpectedEventCount,
    unexpectedEventPct,
    unexpectedPropertyCount,
  }
}
