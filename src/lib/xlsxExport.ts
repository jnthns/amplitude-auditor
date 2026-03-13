import * as XLSX from 'xlsx'
import { calculateAreaScores } from './scoring'
import type { AuditResult, ExecSummary, ParsedSchema } from '../types/audit'

function summaryRows(summary: ExecSummary, customerName: string, projectId: string) {
  const rows: Array<Array<string | number>> = [
    ['Customer', customerName],
    ['Project ID', projectId || 'N/A'],
    ['Overall Score', `${summary.overallScore.earned}/${summary.overallScore.possible}`],
    ['Percentage', `${summary.overallScore.percentage}%`],
    ['Grade', summary.overallScore.grade],
    [],
    ['Top Takeaways'],
    ...summary.topTakeaways.map((line) => [line]),
    [],
    ['Short-Term Fixes'],
  ]

  for (const fix of summary.shortTermFixes) {
    rows.push([fix.title, fix.issue, fix.impact, fix.steps.join(' | '), fix.amplitudeFeature, fix.actIds.join(', ')])
  }

  rows.push([])
  rows.push(['Medium-Term Fixes'])
  for (const fix of summary.mediumTermFixes) {
    rows.push([fix.title, fix.issue, fix.impact, fix.steps.join(' | '), fix.amplitudeFeature, fix.actIds.join(', ')])
  }

  rows.push([])
  rows.push(['Long-Term Fixes'])
  for (const fix of summary.longTermFixes) {
    rows.push([fix.title, fix.issue, fix.impact, fix.steps.join(' | '), fix.amplitudeFeature, fix.actIds.join(', ')])
  }

  return rows
}

function remediationTier(result: AuditResult): string {
  if (result.impact === 'High' && result.priorityRank !== null && result.priorityRank <= 15) return 'Immediate'
  if (result.impact === 'High') return 'Short-term'
  if (result.impact === 'Medium') return 'Medium-term'
  return 'Long-term'
}

export function exportAuditWorkbook(params: {
  fileName: string
  customerName: string
  projectId: string
  summary: ExecSummary
  results: AuditResult[]
  schema: ParsedSchema
}) {
  const workbook = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows(params.summary, params.customerName, params.projectId))
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary')

  const resultsRows = params.results.map((result) => ({
    'Criteria ID': result.criteriaId,
    Area: result.area,
    Impact: result.impact,
    'Criteria Topic': result.topic,
    'Audit Score': result.score,
    'Audit Comments': result.comments,
    'Remediation Steps': result.remediation ?? '',
    'Amplitude Action': result.amplitudeActions.join(', '),
    'Branch Name': result.branchName,
    'Change Status': result.changeStatus,
    'Customer Sign-Off': result.customerSignOff ? 'Yes' : 'No',
    'Points Earned': result.pointsEarned,
    'Points Possible': result.pointsPossible,
    'Priority Rank': result.priorityRank ?? '',
  }))
  const resultsSheet = XLSX.utils.json_to_sheet(resultsRows)
  XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Audit Results')

  const remediationRows = params.results
    .filter((result) => result.score === 'Fail')
    .map((result) => ({
      Tier: remediationTier(result),
      'Criteria ID': result.criteriaId,
      Area: result.area,
      Issue: result.comments,
      'Remediation Steps': result.remediation ?? '',
      'Amplitude Action': result.amplitudeActions.join(', '),
    }))
  const remediationSheet = XLSX.utils.json_to_sheet(remediationRows)
  XLSX.utils.book_append_sheet(workbook, remediationSheet, 'Remediation Plan')

  const scoringRows = calculateAreaScores(params.results).map((area) => ({
    Area: area.area,
    'Points Earned': area.earned,
    'Points Possible': area.possible,
    Percentage: `${area.percentage}%`,
    'Pass Count': area.passCount,
    'Fail Count': area.failCount,
    'Top Fail': area.topFail ?? '',
  }))
  scoringRows.push({
    Area: 'Overall',
    'Points Earned': params.summary.overallScore.earned,
    'Points Possible': params.summary.overallScore.possible,
    Percentage: `${params.summary.overallScore.percentage}%`,
    'Pass Count': params.results.filter((result) => result.score === 'Pass').length,
    'Fail Count': params.results.filter((result) => result.score === 'Fail').length,
    'Top Fail': '',
  })
  const scoringSheet = XLSX.utils.json_to_sheet(scoringRows)
  XLSX.utils.book_append_sheet(workbook, scoringSheet, 'Scoring Overview')

  const rawStatsRows = [
    { Metric: 'Event Count', Value: params.schema.stats.eventCount },
    { Metric: 'User Property Count', Value: params.schema.stats.userPropertyCount },
    { Metric: 'Avg Properties/Event', Value: params.schema.stats.averagePropertiesPerEvent.toFixed(2) },
    { Metric: 'Zero Query Events', Value: params.schema.stats.zeroQueryEventCount },
    { Metric: 'Zero Property Events', Value: params.schema.stats.zeroPropertyEventCount },
    { Metric: 'Likely PII Properties', Value: params.schema.stats.likelyPiiProperties.join(', ') },
    { Metric: 'Duplicate Property Names', Value: params.schema.stats.duplicatePropertyNames.join(', ') },
  ]
  const rawSheet = XLSX.utils.json_to_sheet(rawStatsRows)
  XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Schema Stats')

  XLSX.writeFile(workbook, params.fileName)
}
