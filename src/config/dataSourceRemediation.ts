import type { DataSource } from '../types/audit'

export type IssueType =
  | 'naming'
  | 'missing_metadata'
  | 'status_governance'
  | 'pii_risk'
  | 'property_quality'

const DEFAULT_STEPS: Record<IssueType, string[]> = {
  naming: ['Publish a naming dictionary.', 'Normalize legacy values with Data Transformations.'],
  missing_metadata: ['Backfill missing descriptions/categories in Data.', 'Assign event owners for all production events.'],
  status_governance: ['Create status review cadence.', 'Block unexpected events after validation window.'],
  pii_risk: ['Flag and block sensitive keys.', 'Route sensitive values to hashed or redacted alternatives.'],
  property_quality: ['Define required property sets.', 'Add validation checks in instrumentation pipeline.'],
}

export const DATA_SOURCE_REMEDIATION: Record<DataSource, Record<IssueType, string[]>> = {
  Segment: {
    naming: [...DEFAULT_STEPS.naming, 'Enforce naming in Segment Protocols.'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Sync Segment tracking plan metadata to Amplitude.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Use Protocols blocking to prevent bad events upstream.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Use Segment privacy controls before forwarding to Amplitude.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Use Segment schema controls for required traits and props.'],
  },
  'Other CDP': {
    naming: [...DEFAULT_STEPS.naming, 'Use CDP schema contracts and transformations for naming consistency.'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Backfill CDP event metadata and sync it to Amplitude.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Use upstream CDP governance controls to block bad events.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Apply CDP privacy filters before forwarding events.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Standardize property types and required fields in CDP transforms.'],
  },
  Warehouse: {
    naming: [...DEFAULT_STEPS.naming, 'Define canonical naming at the model layer (dbt/views).'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Document event and property semantics in warehouse docs.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Gate outbound tables/views with data quality checks.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Mask or drop sensitive columns before sync to Amplitude.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Add model tests for required fields and allowed values.'],
  },
  APIs: {
    naming: [...DEFAULT_STEPS.naming, 'Enforce payload naming with API schema validation.'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Version and publish API event contracts.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Reject non-compliant telemetry payloads at ingestion endpoints.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Apply server-side redaction before forwarding analytics events.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Validate required payload fields and data types in middleware.'],
  },
  'Amplitude SDK': {
    naming: [...DEFAULT_STEPS.naming, 'Bake naming linters into CI for SDK events.'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Require instrumentation PR templates with metadata.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Run weekly status audits in Amplitude Data.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Implement client-side allowlist for analytics props.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Create wrapper functions enforcing required property contracts.'],
  },
  'Google Tag Manager': {
    naming: [...DEFAULT_STEPS.naming, 'Standardize tag naming in GTM workspaces.'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Track event purpose in GTM notes and sync docs.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Archive obsolete tags and enforce approval flow.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Use GTM variable filters to strip sensitive fields.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Audit data layer consistency before tag firing.'],
  },
  'CDP / Reverse ETL': {
    naming: [...DEFAULT_STEPS.naming, 'Define canonical naming in warehouse models.'],
    missing_metadata: [...DEFAULT_STEPS.missing_metadata, 'Store event dictionary with dbt docs.'],
    status_governance: [...DEFAULT_STEPS.status_governance, 'Add data contracts on outbound reverse ETL models.'],
    pii_risk: [...DEFAULT_STEPS.pii_risk, 'Filter sensitive columns at model layer.'],
    property_quality: [...DEFAULT_STEPS.property_quality, 'Validate schema with automated model tests.'],
  },
}
