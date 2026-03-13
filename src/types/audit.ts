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

export interface ParsedProperty {
  propertyName: string
  propertyType?: string
  description?: string
}

export interface ParsedEvent {
  eventName: string
  displayName?: string
  description?: string
  category?: string
  status?: string
  volume?: number
  queryCount?: number
  firstSeen?: string
  lastSeen?: string
  properties: ParsedProperty[]
}

export interface ParsedSchemaStats {
  eventCount: number
  userPropertyCount: number
  eventStatusCounts: Record<string, number>
  namingConventionCounts: Record<string, number>
  averagePropertiesPerEvent: number
  zeroQueryEventCount: number
  zeroPropertyEventCount: number
  likelyPiiProperties: string[]
  duplicatePropertyNames: string[]
  topEventsByVolume: Array<{ eventName: string; volume: number }>
}

export interface ParsedSchema {
  events: ParsedEvent[]
  userProperties: ParsedProperty[]
  stats: ParsedSchemaStats
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

export interface ExecutiveFix {
  title: string
  issue: string
  impact: string
  steps: string[]
  amplitudeFeature: string
  actIds: string[]
}

export interface ExecSummary {
  overallScore: {
    earned: number
    possible: number
    percentage: number
    grade: string
  }
  topTakeaways: string[]
  shortTermFixes: ExecutiveFix[]
  mediumTermFixes: ExecutiveFix[]
  longTermFixes: ExecutiveFix[]
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
