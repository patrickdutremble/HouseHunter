interface StatusBadgeProps {
  status: string | null
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-slate-400">—</span>

  const styles: Record<string, string> = {
    complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    partial: 'bg-amber-50 text-amber-700 border-amber-200',
    pending: 'bg-slate-50 text-slate-500 border-slate-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  }

  const style = styles[status] ?? styles.pending

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${style}`}>
      {status}
    </span>
  )
}
