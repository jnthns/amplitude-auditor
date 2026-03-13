import { useState } from 'react'

interface ExpandableCellProps {
  text: string
}

function ExpandableCell({ text }: ExpandableCellProps) {
  const [expanded, setExpanded] = useState(false)

  if (!text) {
    return <span className="text-slate-400">-</span>
  }

  const shouldClamp = !expanded && text.length > 140
  const visibleText = shouldClamp ? `${text.slice(0, 140)}...` : text

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm">{visibleText}</p>
      {text.length > 140 ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-arctic-700 hover:text-arctic-900"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}

export default ExpandableCell
