import Papa from 'papaparse'
import { computeStats } from './preProcess'
import type { ParsedEvent, ParsedEventProperty, ParsedSchema, ParsedSchemaStats, ParsedUserProperty } from '../types/audit'

const EVENTS_REQUIRED_HEADERS = ['Object Type', 'Object Name', 'Event Schema Status', 'Event Activity', 'Event 30 Day Volume', 'Event Property Name']
const USER_REQUIRED_HEADERS = ['Property Type', 'Property Name', 'Property Schema Status']
const BOM = /^\uFEFF/
const MAX_UPLOAD_BYTES = 75 * 1024 * 1024

function parseBoolean(value: string | undefined): boolean {
  return (value || '').trim().toUpperCase() == 'TRUE'
}

function toInt(value: string | undefined): number {
  const parsed = parseInt((value || '').replace(/,/g, '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

async function parseCsvRowsAsObjects(file: File): Promise<Record<string, string>[]> {
  const text = (await file.text()).replace(BOM, '')
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    })
  })
}

async function parseCsvRowsAsArrays(file: File): Promise<string[][]> {
  const text = (await file.text()).replace(BOM, '')
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    })
  })
}

function ensureCsvFile(file: File, label: string) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error(`${label} must be a .csv file.`)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${label} is larger than 75MB. Please split export files before auditing.`)
  }
}

function pick(row: Record<string, string>, key: string): string {
  return (row[key] || '').trim()
}

export async function parseEventsCsv(file: File): Promise<ParsedEvent[]> {
  ensureCsvFile(file, 'Events + Event Properties CSV')

  const rows = await parseCsvRowsAsObjects(file)
  if (rows.length === 0) {
    throw new Error('Events CSV appears to be empty.')
  }

  const headers = Object.keys(rows[0])
  for (const header of EVENTS_REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`Events CSV missing required column: ${header}`)
    }
  }

  const hasAnyVolume = rows.some((row) => Boolean(pick(row, 'Event 30 Day Volume')))
  if (!hasAnyVolume) {
    console.warn('Event 30 Day Volume is empty across rows. Volume-based findings may be less precise.')
  }

  const events: ParsedEvent[] = []
  let currentEvent: ParsedEvent | null = null

  for (const row of rows) {
    const objectType = pick(row, 'Object Type')
    const propertyType = pick(row, 'Property Type')

    if (objectType === 'Event') {
      const event: ParsedEvent = {
        name: pick(row, 'Object Name'),
        displayName: pick(row, 'Event Display Name'),
        description: pick(row, 'Object Description'),
        category: pick(row, 'Event Category'),
        tags: pick(row, 'Tags'),
        schemaStatus: pick(row, 'Event Schema Status'),
        activity: pick(row, 'Event Activity'),
        hiddenFromDropdowns: parseBoolean(pick(row, 'Event Hidden From Dropdowns')),
        hiddenFromPersona: parseBoolean(pick(row, 'Event Hidden From Persona Results')),
        hiddenFromPathfinder: parseBoolean(pick(row, 'Event Hidden From Pathfinder')),
        hiddenFromTimeline: parseBoolean(pick(row, 'Event Hidden From Timeline')),
        source: pick(row, 'Event Source'),
        volume30d: toInt(pick(row, 'Event 30 Day Volume')),
        queries30d: toInt(pick(row, 'Event 30 Day Queries')),
        firstSeen: pick(row, 'Event First Seen'),
        lastSeen: pick(row, 'Event Last Seen'),
        properties: [],
        // legacy aliases
        eventName: pick(row, 'Object Name'),
        status: pick(row, 'Event Schema Status'),
        volume: toInt(pick(row, 'Event 30 Day Volume')),
        queryCount: toInt(pick(row, 'Event 30 Day Queries')),
      }
      events.push(event)
      currentEvent = event
      continue
    }

    if (propertyType === 'Event Property') {
      if (!currentEvent) continue
      const property: ParsedEventProperty = {
        name: pick(row, 'Event Property Name'),
        description: pick(row, 'Property Description'),
        category: pick(row, 'Property Category'),
        valueType: pick(row, 'Property Value Type'),
        schemaStatus: pick(row, 'Property Schema Status'),
        required: parseBoolean(pick(row, 'Property Required')),
        visibility: pick(row, 'Property Visibility'),
        isArray: parseBoolean(pick(row, 'Property Is Array')),
        enumValues: pick(row, 'Enum Values'),
        constValue: pick(row, 'Const Value'),
        regex: pick(row, 'Property Regex'),
        firstSeen: pick(row, 'Property First Seen'),
        lastSeen: pick(row, 'Property Last Seen'),
        // legacy aliases
        propertyName: pick(row, 'Event Property Name'),
        propertyType: pick(row, 'Property Value Type'),
      }
      if (property.name) {
        currentEvent.properties.push(property)
      }
    }
  }

  if (!events.length) {
    throw new Error('Events CSV must include at least one row with Object Type = Event.')
  }

  return events.filter((event) => (event.activity || '').toUpperCase() !== 'INACTIVE')
}

export async function parseUserPropertiesCsv(file: File): Promise<ParsedUserProperty[]> {
  ensureCsvFile(file, 'User Properties CSV')

  const objectRows = await parseCsvRowsAsObjects(file)
  if (objectRows.length === 0) {
    throw new Error('User properties CSV appears to be empty.')
  }

  const headers = Object.keys(objectRows[0])
  for (const header of USER_REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`User Properties CSV missing required column: ${header}`)
    }
  }

  const rows = await parseCsvRowsAsArrays(file)
  const dataRows = rows.slice(1)

  const userProperties: ParsedUserProperty[] = []
  for (const row of dataRows) {
    const propertyType = (row[1] || '').trim()
    if (propertyType !== 'User Property') continue

    const name = (row[2] || '').trim()
    const valueTypeCanonical = (row[5] || '').trim()

    if (!name) continue

    userProperties.push({
      name,
      description: (row[3] || '').trim(),
      category: (row[4] || '').trim(),
      valueType: valueTypeCanonical,
      schemaStatus: (row[6] || '').trim(),
      visibility: (row[7] || '').trim(),
      isArray: ((row[8] || '').trim().toUpperCase() == 'TRUE'),
      enumValues: (row[18] || '').trim(),
      constValue: (row[19] || '').trim(),
      regex: (row[20] || '').trim(),
      firstSeen: (row[21] || '').trim(),
      lastSeen: (row[22] || '').trim(),
      // legacy aliases
      propertyName: name,
      propertyType: valueTypeCanonical,
    })
  }

  if (!userProperties.length) {
    throw new Error('User Properties CSV must include at least one row with Property Type = User Property.')
  }

  return userProperties
}

function toParsedSchemaStats(events: ParsedEvent[], userProperties: ParsedUserProperty[]): ParsedSchemaStats {
  const stats = computeStats(events, userProperties)

  return {
    ...stats,
    eventCount: events.length,
    userPropertyCount: userProperties.length,
    eventStatusCounts: stats.eventsBySchemaStatus,
    namingConventionCounts: stats.namingConventionDistribution,
    averagePropertiesPerEvent: stats.avgPropertiesPerEvent,
    zeroQueryEventCount: stats.zeroQueryEvents.length,
    zeroPropertyEventCount: events.filter((event) => event.properties.length === 0).length,
    likelyPiiProperties: [
      ...stats.suspectedPiiEventProperties.map((item) => item.propertyName),
      ...stats.suspectedPiiUserProperties,
    ],
    duplicatePropertyNames: stats.duplicatePropertyNames,
    topEventsByVolumeLegacy: stats.topEventsByVolume.map((event) => ({ eventName: event.name, volume: event.volume })),
  }
}

export async function parseSchemaFiles(eventsAndPropertiesCsv: File, userPropertiesCsv?: File): Promise<ParsedSchema> {
  const events = await parseEventsCsv(eventsAndPropertiesCsv)
  const userProperties = userPropertiesCsv ? await parseUserPropertiesCsv(userPropertiesCsv) : []

  return {
    events,
    userProperties,
    stats: toParsedSchemaStats(events, userProperties),
  }
}
