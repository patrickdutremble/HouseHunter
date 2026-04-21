import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useTableKeyboard } from '../useTableKeyboard'

interface Harness {
  listings: { id: string }[]
  focusedId: string | null
  selectedId: string | null
  setFocusedId?: (id: string | null) => void
  setSelectedId?: (id: string | null) => void
  onToggleCompare?: (id: string) => void
}

function Harness(props: Harness) {
  useTableKeyboard({
    listings: props.listings,
    focusedId: props.focusedId,
    selectedId: props.selectedId,
    setFocusedId: props.setFocusedId ?? (() => {}),
    setSelectedId: props.setSelectedId ?? (() => {}),
    onToggleCompare: props.onToggleCompare ?? (() => {}),
  })
  return null
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
  })
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const LISTINGS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('useTableKeyboard', () => {
  it('ArrowDown moves focus to next row', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown')
    expect(setFocusedId).toHaveBeenCalledWith('b')
  })

  it('ArrowDown with no focus picks first row', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId={null} selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown')
    expect(setFocusedId).toHaveBeenCalledWith('a')
  })

  it('ArrowUp moves focus to previous row', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowUp')
    expect(setFocusedId).toHaveBeenCalledWith('a')
  })

  it('Enter sets selectedId to focusedId', () => {
    const setSelectedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} setSelectedId={setSelectedId} />)
    press('Enter')
    expect(setSelectedId).toHaveBeenCalledWith('b')
  })

  it('Enter does nothing when nothing is focused', () => {
    const setSelectedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId={null} selectedId={null} setSelectedId={setSelectedId} />)
    press('Enter')
    expect(setSelectedId).not.toHaveBeenCalled()
  })

  it('Escape clears selection when panel is open', () => {
    const setSelectedId = vi.fn()
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId="b" setSelectedId={setSelectedId} setFocusedId={setFocusedId} />)
    press('Escape')
    expect(setSelectedId).toHaveBeenCalledWith(null)
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('Escape clears focus when no panel is open', () => {
    const setSelectedId = vi.fn()
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} setSelectedId={setSelectedId} setFocusedId={setFocusedId} />)
    press('Escape')
    expect(setFocusedId).toHaveBeenCalledWith(null)
    expect(setSelectedId).not.toHaveBeenCalled()
  })

  it('c toggles compare on focused row', () => {
    const onToggleCompare = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} onToggleCompare={onToggleCompare} />)
    press('c')
    expect(onToggleCompare).toHaveBeenCalledWith('b')
  })

  it('c does nothing when nothing is focused', () => {
    const onToggleCompare = vi.fn()
    render(<Harness listings={LISTINGS} focusedId={null} selectedId={null} onToggleCompare={onToggleCompare} />)
    press('c')
    expect(onToggleCompare).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when focus is inside an <input>', () => {
    const setFocusedId = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when focus is inside a <textarea>', () => {
    const setFocusedId = vi.fn()
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    act(() => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when a modifier key is held', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown', { ctrlKey: true })
    press('ArrowDown', { metaKey: true })
    press('ArrowDown', { altKey: true })
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('prevents default on ArrowDown to stop page scroll', () => {
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} />)
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    act(() => { document.dispatchEvent(ev) })
    expect(ev.defaultPrevented).toBe(true)
  })

  it('does not prevent default on unrelated keys', () => {
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} />)
    const ev = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    act(() => { document.dispatchEvent(ev) })
    expect(ev.defaultPrevented).toBe(false)
  })
})
