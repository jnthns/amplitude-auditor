import { exportAuditWorkbook } from '../../lib/xlsxExport'
import type { AuditResult, ExecSummary, ParsedSchema } from '../../types/audit'

interface ExportButtonProps {
  customerName: string
  projectId: string
  summary: ExecSummary
  results: AuditResult[]
  schema: ParsedSchema
}

function ExportButton({ customerName, projectId, summary, results, schema }: ExportButtonProps) {
  return (
    <button
      type="button"
      className="rounded-lg bg-arctic-600 px-4 py-2 text-sm font-semibold text-white hover:bg-arctic-700"
      onClick={() => {
        const date = new Date().toISOString().slice(0, 10)
        const safeName = customerName.trim().replace(/\s+/g, '_') || 'customer'
        exportAuditWorkbook({
          fileName: `${safeName}_taxonomy_audit_${date}.xlsx`,
          customerName,
          projectId,
          summary,
          results,
          schema,
        })
      }}
    >
      Download XLSX
    </button>
  )
}

export default ExportButton
