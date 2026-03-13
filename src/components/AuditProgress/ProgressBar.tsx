interface ProgressBarProps {
  done: number
  total: number
}

function ProgressBar({ done, total }: ProgressBarProps) {
  const ratio = total > 0 ? (done / total) * 100 : 0
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
        <span className="font-medium">Progress</span>
        <span>
          {done} / {total} criteria evaluated
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-200">
        <div className="h-3 rounded-full bg-arctic-600 transition-all" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  )
}

export default ProgressBar
