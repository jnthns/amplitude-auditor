import { useMemo, useState } from 'react'
import Badge from '../shared/Badge'
import ExpandableCell from '../shared/ExpandableCell'
import { useAuditStore } from '../../store/auditStore'
import type { AuditResult, ChangeStatus } from '../../types/audit'

const CHANGE_STATUSES: ChangeStatus[] = ['Pending', 'In Progress', 'Complete', 'Skipped']

function scoreTone(score: AuditResult['score']): 'success' | 'danger' | 'neutral' {
  if (score === 'Pass') return 'success'
  if (score === 'Fail') return 'danger'
  return 'neutral'
}

function impactTone(impact: AuditResult['impact']): 'danger' | 'warning' | 'success' {
  if (impact === 'High') return 'danger'
  if (impact === 'Medium') return 'warning'
  return 'success'
}

function AuditResultsTable() {
  const results = useAuditStore((state) => state.results)
  const updateResultMeta = useAuditStore((state) => state.updateResultMeta)

  const [areaFilter, setAreaFilter] = useState('All')
  const [impactFilter, setImpactFilter] = useState('All')
  const [scoreFilter, setScoreFilter] = useState('All')
  const [changeFilter, setChangeFilter] = useState('All')
  const [sortBy, setSortBy] = useState<'priority' | 'area' | 'impact'>('priority')

  const areas = useMemo(() => Array.from(new Set(results.map((result) => result.area))), [results])

  const filtered = useMemo(() => {
    let next = results.filter((result) => {
      if (areaFilter !== 'All' && result.area !== areaFilter) return false
      if (impactFilter !== 'All' && result.impact !== impactFilter) return false
      if (scoreFilter !== 'All' && result.score !== scoreFilter) return false
      if (changeFilter !== 'All' && result.changeStatus !== changeFilter) return false
      return true
    })

    next = [...next].sort((a, b) => {
      if (sortBy === 'area') return a.area.localeCompare(b.area)
      if (sortBy === 'impact') return a.impact.localeCompare(b.impact)
      const aRank = a.priorityRank ?? Number.MAX_SAFE_INTEGER
      const bRank = b.priorityRank ?? Number.MAX_SAFE_INTEGER
      return aRank - bRank
    })

    return next
  }, [results, areaFilter, impactFilter, scoreFilter, changeFilter, sortBy])

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-1 gap-3 p-4 lg:grid-cols-5">
        <select className="input-base" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
          <option>All</option>
          {areas.map((area) => (
            <option key={area}>{area}</option>
          ))}
        </select>
        <select className="input-base" value={impactFilter} onChange={(event) => setImpactFilter(event.target.value)}>
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <select className="input-base" value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)}>
          <option>All</option>
          <option>Pass</option>
          <option>Fail</option>
          <option>N/A</option>
        </select>
        <select className="input-base" value={changeFilter} onChange={(event) => setChangeFilter(event.target.value)}>
          <option>All</option>
          {CHANGE_STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <select className="input-base" value={sortBy} onChange={(event) => setSortBy(event.target.value as 'priority' | 'area' | 'impact')}>
          <option value="priority">Sort: Priority</option>
          <option value="area">Sort: Area</option>
          <option value="impact">Sort: Impact</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-[1400px] divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
              {['Criteria ID', 'Area', 'Impact', 'Criteria Topic', 'Audit Score', 'Audit Comments', 'Remediation Steps', 'Amplitude Action', 'Branch Name', 'Change Status', 'Customer Sign-Off', 'Points Earned', 'Points Possible', 'Priority Rank'].map((header) => (
                <th key={header} className="px-2 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((result) => (
              <tr key={result.criteriaId} className="align-top">
                <td className="px-2 py-2 font-medium">{result.criteriaId}</td>
                <td className="px-2 py-2">{result.area}</td>
                <td className="px-2 py-2">
                  <Badge label={result.impact} tone={impactTone(result.impact)} />
                </td>
                <td className="px-2 py-2">{result.topic}</td>
                <td className="px-2 py-2">
                  <Badge label={result.score} tone={scoreTone(result.score)} />
                </td>
                <td className="max-w-64 px-2 py-2">
                  <ExpandableCell text={result.comments} />
                </td>
                <td className="max-w-64 px-2 py-2">
                  <ExpandableCell text={result.remediation ?? ''} />
                </td>
                <td className="px-2 py-2 text-arctic-700">{result.amplitudeActions.join(', ') || '-'}</td>
                <td className="px-2 py-2">
                  <input
                    className="input-base min-w-32"
                    value={result.branchName}
                    onChange={(event) => updateResultMeta(result.criteriaId, { branchName: event.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="input-base min-w-32"
                    value={result.changeStatus}
                    onChange={(event) => updateResultMeta(result.criteriaId, { changeStatus: event.target.value as ChangeStatus })}
                  >
                    {CHANGE_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={result.customerSignOff}
                    onChange={(event) => updateResultMeta(result.criteriaId, { customerSignOff: event.target.checked })}
                  />
                </td>
                <td className="px-2 py-2">{result.pointsEarned}</td>
                <td className="px-2 py-2">{result.pointsPossible}</td>
                <td className="px-2 py-2">{result.priorityRank ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AuditResultsTable
