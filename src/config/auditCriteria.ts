import type { AuditCriterion, CriteriaImpact } from '../types/audit'

const AREAS = [
  { code: 'NS', name: 'Naming Standards', topics: ['Event naming consistency', 'Property naming consistency', 'Verb-first event names', 'Namespace hygiene', 'Display name readability'] },
  { code: 'SC', name: 'Schema Completeness', topics: ['Description coverage', 'Category coverage', 'Owner metadata', 'Status metadata', 'Tracking plan alignment'] },
  { code: 'GS', name: 'Governance & Status', topics: ['Unexpected event handling', 'Blocked event usage', 'Deprecated cleanup', 'Status policy enforcement', 'Branch workflow adoption'] },
  { code: 'PH', name: 'Property Hygiene', topics: ['Property type consistency', 'Null/empty value prevalence', 'Property duplication', 'Enum standardization', 'Required property coverage'] },
  { code: 'PC', name: 'PII & Compliance', topics: ['PII detection', 'Sensitive event review', 'Privacy-safe naming', 'Consent status usage', 'Regulatory metadata tagging'] },
  { code: 'VU', name: 'Volume & Usage', topics: ['Zero-query events', 'Long-tail event value', 'High-volume anomalies', 'Event utilization distribution', 'Unused property pruning'] },
  { code: 'EX', name: 'Experimentation', topics: ['Exposure event standards', 'Variant property coverage', 'Assignment reliability', 'Experiment outcome linkage', 'Experiment naming conventions'] },
  { code: 'GA', name: 'Group Analytics', topics: ['Group type usage', 'Account identifier quality', 'Group property consistency', 'B2B event attribution', 'Group-level KPI readiness'] },
  { code: 'OR', name: 'Operational Readiness', topics: ['Implementation runbooks', 'Schema change communication', 'QA instrumentation checks', 'Rollback strategy', 'Ownership and support model'] },
] as const

const impactPattern: CriteriaImpact[] = ['High', 'Medium', 'Low', 'Medium', 'High']

export const AUDIT_CRITERIA: AuditCriterion[] = AREAS.flatMap((area) =>
  area.topics.map((topic, index) => {
    const seq = index + 1
    return {
      id: `${area.code}-${String(seq).padStart(3, '0')}`,
      area: area.name,
      impact: impactPattern[index],
      topic,
      description: `Assess ${topic.toLowerCase()} using exported schema evidence and usage behavior.`,
      passCriteria: `Evidence shows ${topic.toLowerCase()} is consistent and production-ready.`,
      failCriteria: `Evidence shows gaps in ${topic.toLowerCase()} causing analysis risk or governance debt.`,
      pointsPossible: impactPattern[index] === 'High' ? 3 : impactPattern[index] === 'Medium' ? 2 : 1,
    }
  }),
)

export const AUDIT_AREAS = AREAS.map((area) => area.name)

export const AUDIT_CRITERIA_BY_AREA = AUDIT_CRITERIA.reduce<Record<string, AuditCriterion[]>>((acc, criterion) => {
  const existing = acc[criterion.area] ?? []
  existing.push(criterion)
  acc[criterion.area] = existing
  return acc
}, {})
