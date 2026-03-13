interface BadgeProps {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}

const tones = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  danger: 'bg-rose-100 text-rose-800 border-rose-200',
  info: 'bg-arctic-100 text-arctic-800 border-arctic-200',
}

function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{label}</span>
}

export default Badge
