'use client'

export type ViewMode = 'table' | 'map'

interface ViewToggleProps {
  current: ViewMode
  onChange: (next: ViewMode) => void
}

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      {(['table', 'map'] as const).map((mode) => {
        const active = current === mode
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(mode)}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              active
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {mode === 'table' ? 'Table' : 'Map'}
          </button>
        )
      })}
    </div>
  )
}
