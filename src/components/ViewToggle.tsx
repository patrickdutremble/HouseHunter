'use client'

export type ViewMode = 'table' | 'map'

interface ViewToggleProps {
  current: ViewMode
  onChange: (next: ViewMode) => void
}

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
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
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            {mode === 'table' ? 'Table' : 'Map'}
          </button>
        )
      })}
    </div>
  )
}
