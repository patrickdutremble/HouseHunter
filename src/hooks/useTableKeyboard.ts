'use client'

import { useEffect } from 'react'
import { nextId, prevId } from '@/lib/keyboard-nav'

interface HasId {
  id: string
}

interface UseTableKeyboardArgs<T extends HasId> {
  listings: T[]
  focusedId: string | null
  selectedId: string | null
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  onToggleCompare: (id: string) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function useTableKeyboard<T extends HasId>({
  listings,
  focusedId,
  selectedId,
  setFocusedId,
  setSelectedId,
  onToggleCompare,
}: UseTableKeyboardArgs<T>) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (isTypingTarget(document.activeElement)) return

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const next = nextId(listings, focusedId)
          if (next !== null) setFocusedId(next)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prev = prevId(listings, focusedId)
          if (prev !== null) setFocusedId(prev)
          break
        }
        case 'Enter': {
          if (focusedId === null) return
          e.preventDefault()
          setSelectedId(focusedId)
          break
        }
        case 'Escape': {
          if (selectedId !== null) {
            e.preventDefault()
            setSelectedId(null)
          } else if (focusedId !== null) {
            e.preventDefault()
            setFocusedId(null)
          }
          break
        }
        case 'c':
        case 'C': {
          if (focusedId === null) return
          e.preventDefault()
          onToggleCompare(focusedId)
          break
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [listings, focusedId, selectedId, setFocusedId, setSelectedId, onToggleCompare])
}
