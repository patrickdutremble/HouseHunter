export interface HasId {
  id: string
}

export function firstId<T extends HasId>(items: T[]): string | null {
  return items[0]?.id ?? null
}

export function lastId<T extends HasId>(items: T[]): string | null {
  return items[items.length - 1]?.id ?? null
}

export function nextId<T extends HasId>(items: T[], current: string | null): string | null {
  if (items.length === 0) return null
  if (current === null) return items[0].id
  const idx = items.findIndex(i => i.id === current)
  if (idx === -1) return items[0].id
  if (idx >= items.length - 1) return items[idx].id
  return items[idx + 1].id
}

export function prevId<T extends HasId>(items: T[], current: string | null): string | null {
  if (items.length === 0) return null
  if (current === null) return items[items.length - 1].id
  const idx = items.findIndex(i => i.id === current)
  if (idx === -1) return items[items.length - 1].id
  if (idx <= 0) return items[0].id
  return items[idx - 1].id
}
