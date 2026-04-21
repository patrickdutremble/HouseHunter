import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RefreshStatusesButton } from '../RefreshStatusesButton'

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('RefreshStatusesButton', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('renders the button', () => {
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    expect(screen.getByRole('button', { name: /refresh statuses/i })).toBeTruthy()
  })

  it('POSTs on click and calls onRefreshed with summary', async () => {
    mockFetch(async () => new Response(JSON.stringify({
      checked: 2, unavailable: 1, priceChanged: 0, errors: 0,
    }), { status: 200 }))
    const onRefreshed = vi.fn()
    render(<RefreshStatusesButton onRefreshed={onRefreshed} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh statuses/i }))
    await waitFor(() => {
      expect(onRefreshed).toHaveBeenCalledWith({ checked: 2, unavailable: 1, priceChanged: 0, errors: 0 })
    })
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe('/api/refresh-statuses')
  })

  it('shows result message after success', async () => {
    mockFetch(async () => new Response(JSON.stringify({
      checked: 5, unavailable: 1, priceChanged: 2, errors: 0,
    }), { status: 200 }))
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh statuses/i }))
    await waitFor(() => {
      expect(screen.getByText(/Checked 5/)).toBeTruthy()
      expect(screen.getByText(/1 unavailable/)).toBeTruthy()
      expect(screen.getByText(/2 price changes/)).toBeTruthy()
    })
  })

  it('disables button while running', async () => {
    let resolve: (v: Response) => void = () => {}
    mockFetch(() => new Promise<Response>(r => { resolve = r }))
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    const btn = screen.getByRole('button', { name: /refresh statuses/i }) as HTMLButtonElement
    fireEvent.click(btn)
    expect(btn.disabled).toBe(true)
    resolve(new Response(JSON.stringify({ checked: 0, unavailable: 0, priceChanged: 0, errors: 0 }), { status: 200 }))
    await waitFor(() => expect(btn.disabled).toBe(false))
  })

  it('shows error message when fetch fails', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }))
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh statuses/i }))
    await waitFor(() => {
      expect(screen.getByText(/refresh failed/i)).toBeTruthy()
    })
  })
})
