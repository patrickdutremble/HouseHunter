'use client'

interface FavoriteButtonProps {
  value: boolean
  onToggle: () => void
  size?: number
}

export function FavoriteButton({ value, onToggle, size = 18 }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={value ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={value}
      className={`
        inline-flex items-center justify-center rounded transition-colors
        ${value ? 'text-amber-500 hover:text-amber-600 dark:hover:text-amber-400' : 'text-fg-subtle hover:text-amber-400'}
      `}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill={value ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M10 2.5l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 14.8l-4.78 2.51.91-5.32L2.27 8.12l5.34-.78L10 2.5z" />
      </svg>
    </button>
  )
}
