import Papa from 'papaparse'
import { computeSchemaStats } from './scoring'
import type { ParsedEvent, ParsedProperty, ParsedSchema } from '../types/audit'

const REQUIRED_EVENT_HEADERS = [
  'Event Name',
  'Display Name',
  'Description',
  'Category',
  'Status',
  'Volume',
  'Query Count',
  'First Seen',
  'Last Seen',
] as const

const BOM = /^\uFEFF/
const MAX_UPLOAD_BYTES = 75 * 1024 * 1024
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function parseCsvRows(file: File): Promise<Record<string, string>[]> {
  const text = (await file.text()).replace(BOM, '').replace(/\r\n/g, '\n')

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    })
  })
}

function validateHeaders(rows: Record<string, string>[]) {
  if (rows.length === 0) {
    throw new Error('Events CSV appears to be empty.')
  }

  const headers = Object.keys(rows[0])
  const missing = REQUIRED_EVENT_HEADERS.filter((header) => !headers.includes(header))

  if (missing.length > 0) {
    throw new Error(`Events CSV missing required columns: ${missing.join(', ')}`)
  }
}

function buildEvents(rows: Record<string, string>[]): ParsedEvent[] {
  const eventMap = new Map<string, ParsedEvent>()

  for (const row of rows) {
    const eventName = (row['Event Name'] ?? '').trim()
    if (!eventName) continue

    const event = eventMap.get(eventName) ?? {
      eventName,
      displayName: row['Display Name']?.trim() || undefined,
      description: row['Description']?.trim() || undefined,
      category: row['Category']?.trim() || undefined,
      status: row['Status']?.trim() || undefined,
      volume: parseNumber(row['Volume']),
      queryCount: parseNumber(row['Query Count']),
      firstSeen: row['First Seen']?.trim() || undefined,
      lastSeen: row['Last Seen']?.trim() || undefined,
      properties: [],
    }

    const propertyName = row['Property Name']?.trim()
    if (propertyName) {
      event.properties.push({
        propertyName,
        propertyType: row['Property Type']?.trim() || undefined,
        description: row['Property Description']?.trim() || undefined,
      })
    }

    eventMap.set(eventName, event)
  }

  return Array.from(eventMap.values())
}

function buildUserProperties(rows: Record<string, string>[]): ParsedProperty[] {
  return rows
    .map((row) => ({
      propertyName: row['Property Name']?.trim() ?? '',
      propertyType: row['Property Type']?.trim() || undefined,
      description: row['Description']?.trim() || undefined,
    }))
    .filter((property) => property.propertyName.length > 0)
}

export async function parseSchemaFiles(eventsAndPropertiesCsv: File, userPropertiesCsv?: File): Promise<ParsedSchema> {
  if (!eventsAndPropertiesCsv.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Events + Event Properties file must be a .csv file.')
  }
  if (userPropertiesCsv && !userPropertiesCsv.name.toLowerCase().endsWith('.csv')) {
    throw new Error('User Properties file must be a .csv file.')
  }

  if (eventsAndPropertiesCsv.size > MAX_UPLOAD_BYTES || (userPropertiesCsv?.size ?? 0) > MAX_UPLOAD_BYTES) {
    throw new Error(`One of the uploaded files is larger than ${MAX_UPLOAD_MB}MB. Please split export files before auditing.`)
  }

  const eventRows = await parseCsvRows(eventsAndPropertiesCsv)
  validateHeaders(eventRows)

  const userRows = userPropertiesCsv ? await parseCsvRows(userPropertiesCsv) : []

  const events = buildEvents(eventRows)
  const userProperties = buildUserProperties(userRows)
  const stats = computeSchemaStats(events, userProperties)

  return {
    events,
    userProperties,
    stats,
  }
}
