import type { AmplitudeAction } from '../types/audit'

export const AMPLITUDE_ACTIONS: AmplitudeAction[] = [
  { id: 'ACT-001', feature: 'Amplitude Govern', title: 'Block unexpected events', description: 'Use block rules to prevent invalid event ingestion.' },
  { id: 'ACT-002', feature: 'Amplitude Govern', title: 'Mark status lifecycle', description: 'Use status transitions for Live, Unexpected, Blocked, and Deleted events.' },
  { id: 'ACT-003', feature: 'Amplitude Data', title: 'Enforce schema contract', description: 'Validate instrumentation against tracking plan definitions.' },
  { id: 'ACT-004', feature: 'Amplitude Data Transformations', title: 'Rename event display names', description: 'Normalize display names without changing implementation keys.' },
  { id: 'ACT-005', feature: 'Amplitude Data Transformations', title: 'Reclassify properties', description: 'Migrate and standardize property naming at ingest time.' },
  { id: 'ACT-006', feature: 'Amplitude Data', title: 'Create branch reviews', description: 'Use Data branches to review taxonomy updates before merge.' },
  { id: 'ACT-007', feature: 'Amplitude Govern', title: 'Set ownership fields', description: 'Attach owners and teams to events for accountability.' },
  { id: 'ACT-008', feature: 'Amplitude APIs', title: 'Bulk metadata update', description: 'Use Taxonomy API to update descriptions, categories, and statuses.' },
  { id: 'ACT-009', feature: 'Amplitude Govern', title: 'PII safeguards', description: 'Set guardrails and alerts for sensitive property patterns.' },
  { id: 'ACT-010', feature: 'Amplitude Data', title: 'Tracking plan import', description: 'Import canonical schema from source of truth.' },
  { id: 'ACT-011', feature: 'Amplitude Experiment', title: 'Standardize exposure events', description: 'Use consistent exposure event schema and required properties.' },
  { id: 'ACT-012', feature: 'Amplitude Experiment', title: 'Bind outcomes to variants', description: 'Link experiment variants to decision metrics reliably.' },
  { id: 'ACT-013', feature: 'Amplitude Groups', title: 'Define group types', description: 'Enable account and organization-level analytics for B2B.' },
  { id: 'ACT-014', feature: 'Amplitude Groups', title: 'Enrich group properties', description: 'Attach stable account attributes for segmentation.' },
  { id: 'ACT-015', feature: 'Amplitude Govern', title: 'Monitor schema drift', description: 'Create alerts for unexpected growth in event or property volume.' },
  { id: 'ACT-016', feature: 'Amplitude Data', title: 'Property schema checks', description: 'Validate required property sets before release.' },
  { id: 'ACT-017', feature: 'Amplitude APIs', title: 'Automated cleanup jobs', description: 'Run periodic API jobs to archive stale taxonomy elements.' },
  { id: 'ACT-018', feature: 'Amplitude Data Transformations', title: 'Normalize enum values', description: 'Map inconsistent property values to a canonical set.' },
  { id: 'ACT-019', feature: 'Amplitude Govern', title: 'Define naming policy', description: 'Publish and enforce naming conventions with validation checks.' },
  { id: 'ACT-020', feature: 'Amplitude Data Assistant', title: 'Guided remediation workflow', description: 'Use in-product recommendations to fix instrumentation gaps faster.' },
]
