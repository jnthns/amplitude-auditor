export type DataSource =
  | 'Segment'
  | 'Other CDP'
  | 'Warehouse'
  | 'APIs'
  | 'Amplitude SDK'
  | 'Google Tag Manager'
  | 'CDP / Reverse ETL'

export type ComplianceRequirement =
  | 'SOC2'
  | 'GDPR'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'CCPA'
  | 'None'

export type Industry =
  | 'Fintech'
  | 'SaaS'
  | 'E-commerce'
  | 'Media'
  | 'Healthcare'
  | 'Gaming'
  | 'Other'

export type CriteriaImpact = 'High' | 'Medium' | 'Low'
export type AuditScore = 'Pass' | 'Fail' | 'N/A'
export type ChangeStatus = 'Pending' | 'In Progress' | 'Complete' | 'Skipped'

export interface FormState {
  customerName: string
  projectId: string
  industry?: Industry | string
  industryOther?: string
  dataSources: DataSource[]
  compliance: ComplianceRequirement[]
  knownConcerns: string
  geminiApiKey: string
}

// ============================================================
// CSV Parsed Types
// ============================================================

export interface ParsedEventProperty {
  name: string
  description: string
  category: string
  valueType: string
  schemaStatus: string
  required: boolean
  visibility: string
  isArray: boolean
  enumValues: string
  constValue: string
  regex: string
  firstSeen: string
  lastSeen: string
  // legacy aliases used in existing UI/helpers
  propertyName: string
  propertyType: string
}

export interface ParsedUserProperty {
  name: string
  description: string
  category: string
  valueType: string
  schemaStatus: string
  visibility: string
  isArray: boolean
  enumValues: string
  constValue: string
  regex: string
  firstSeen: string
  lastSeen: string
  // legacy aliases used in existing UI/helpers
  propertyName: string
  propertyType: string
}

export interface ParsedEvent {
  name: string
  displayName: string
  description: string
  category: string
  tags: string
  schemaStatus: string
  activity: string
  hiddenFromDropdowns: boolean
  hiddenFromPersona: boolean
  hiddenFromPathfinder: boolean
  hiddenFromTimeline: boolean
  source: string
  volume30d: number
  queries30d: number
  firstSeen: string
  lastSeen: string
  properties: ParsedEventProperty[]
  // legacy aliases used in existing UI/helpers
  eventName: string
  status: string
  volume: number
  queryCount: number
}

// legacy alias retained for existing helper imports
export type ParsedProperty = ParsedEventProperty

// ============================================================
// Pre-Processed Stats
// ============================================================

export interface PreProcessedStats {
  totalEventRows: number
  activeEvents: number
  inactiveEvents: number
  eventsBySchemaStatus: Record<string, number>

  namingConventions: Record<string, string[]>
  namingConventionDistribution: Record<string, number>
  propertyNamingConventions: Record<string, number>

  totalVolume30d: number
  topEventsByVolume: Array<{ name: string; volume: number; queries: number }>
  zeroQueryEvents: Array<{ name: string; volume: number }>
  zeroQueryEventVolume: number

  avgPropertiesPerEvent: number
  maxPropertiesPerEvent: { eventName: string; count: number }
  eventsWithOver20Properties: string[]
  totalUserProperties: number

  suspectedPiiEventProperties: Array<{ eventName: string; propertyName: string }>
  suspectedPiiUserProperties: string[]

  duplicatePropertyNames: string[]

  eventsWithoutDescription: number
  eventsWithDescription: number
  eventPropertiesWithoutDescription: number
  userPropertiesWithoutDescription: number

  eventsWithCategory: number
  eventsWithoutCategory: number
  uniqueCategories: string[]

  screenViewPatterns: string[]
  clickPatterns: string[]

  unexpectedEventCount: number
  unexpectedEventPct: number
  unexpectedPropertyCount: number
}

export interface ParsedSchemaStats extends Partial<PreProcessedStats> {
  // compatibility fields used by existing report/xlsx components
  eventCount: number
  userPropertyCount: number
  eventStatusCounts: Record<string, number>
  namingConventionCounts: Record<string, number>
  averagePropertiesPerEvent: number
  zeroQueryEventCount: number
  zeroPropertyEventCount: number
  likelyPiiProperties: string[]
  duplicatePropertyNames: string[]
  topEventsByVolumeLegacy: Array<{ eventName: string; volume: number }>
}

export interface ParsedSchema {
  events: ParsedEvent[]
  userProperties: ParsedUserProperty[]
  stats: ParsedSchemaStats
}

// ============================================================
// LLM Result Types
// ============================================================

export interface CriterionResult {
  criteriaId: string
  score: AuditScore
  comments: string
  remediation: string | null
  amplitudeActions: string[]
  pointsEarned: number
  pointsPossible: number
}

export interface FixRecommendation {
  title: string
  issue: string
  impact: string
  steps: string[]
  amplitudeFeature: string
  actIds: string[]
  effort: 'Low' | 'Medium' | 'High'
  criteriaIds: string[]
}

export interface ExecutiveSummary {
  overallScore: {
    earned: number
    possible: number
    percentage: number
    grade: 'Needs Improvement' | 'Meets Expectations' | 'Exceeds Expectations'
  }
  topTakeaways: string[]
  shortTermFixes: FixRecommendation[]
  mediumTermFixes: FixRecommendation[]
  longTermFixes: FixRecommendation[]
}

// existing alias retained for compatibility
export type ExecSummary = ExecutiveSummary

// ============================================================
// Intake / Store Types
// ============================================================

export interface IntakeFormData {
  customerName: string
  projectId: string
  dataSources: string[]
  industry: string
  compliance: string[]
  concerns: string
  geminiApiKey: string
}

export interface AuditCriterion {
  id: string
  area: string
  impact: CriteriaImpact
  topic: string
  description: string
  passCriteria: string
  failCriteria: string
  pointsPossible: number
}

export interface AuditResult {
  criteriaId: string
  area: string
  impact: CriteriaImpact
  topic: string
  score: AuditScore
  comments: string
  remediation: string | null
  amplitudeActions: string[]
  pointsEarned: number
  pointsPossible: number
  priorityRank: number | null
  branchName: string
  changeStatus: ChangeStatus
  customerSignOff: boolean
}

export interface AreaScore {
  area: string
  earned: number
  possible: number
  percentage: number
  passCount: number
  failCount: number
  naCount: number
  topFail?: string
}

export interface AmplitudeAction {
  id: string
  feature: string
  title: string
  description: string
}

export interface AreaProgress {
  area: string
  criteriaTotal: number
  criteriaDone: number
  pass: number
  fail: number
  na: number
  scoreEarned: number
  scorePossible: number
}

export type AuditStatus = 'idle' | 'running' | 'complete' | 'cancelled' | 'error'
