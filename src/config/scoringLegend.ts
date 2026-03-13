import type { CriteriaImpact } from '../types/audit'

export const IMPACT_WEIGHTS: Record<CriteriaImpact, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
}

export const GRADE_THRESHOLDS = [
  { minPercent: 85, label: 'Exceeds Expectations' },
  { minPercent: 65, label: 'Meets Expectations' },
  { minPercent: 0, label: 'Needs Improvement' },
] as const
