interface StarIconProps {
  filled: boolean
  size: number
}

/**
 * The shared star glyph. Presentational only — callers supply their own
 * button, colours and ARIA. Used both by the per-listing favorite setter
 * (FavoriteButton) and by the favorites-only filter toggle on /recent.
 */
export function StarIcon({ filled, size }: StarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 2.5l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 14.8l-4.78 2.51.91-5.32L2.27 8.12l5.34-.78L10 2.5z" />
    </svg>
  )
}
