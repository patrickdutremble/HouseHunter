'use client'

import { StarIcon } from '@/components/StarIcon'

interface FavoriteButtonProps {
  value: boolean
  onToggle: () => void
  size?: number
  className?: string
  disabled?: boolean
}

export function FavoriteButton({ value, onToggle, size = 18, className = '', disabled = false }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={value ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={value}
      className={`
        inline-flex items-center justify-center rounded transition-colors disabled:opacity-50
        ${value ? 'text-amber-500 hover:text-amber-600 dark:hover:text-amber-400' : 'text-fg-subtle hover:text-amber-400'}
        ${className}
      `}
    >
      <StarIcon filled={value} size={size} />
    </button>
  )
}
