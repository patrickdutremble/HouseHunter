'use client'

interface FlagButtonProps {
  value: boolean
  onToggle: () => void
  size?: number
}

export function FlagButton({ value, onToggle, size = 18 }: FlagButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={value ? 'Unflag' : 'Flag for deletion'}
      aria-pressed={value}
      className={`
        inline-flex items-center justify-center rounded transition-colors
        ${value ? 'text-red-500 hover:text-red-600 dark:hover:text-red-400' : 'text-fg-subtle hover:text-red-400'}
      `}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={value ? 2.5 : 1.75}
        strokeLinecap="round"
      >
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  )
}
