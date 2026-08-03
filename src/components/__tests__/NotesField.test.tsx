import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotesField } from '@/components/NotesField'

describe('NotesField', () => {
  it('renders a tappable placeholder when there are no notes', () => {
    render(<NotesField value={null} onSave={async () => true} />)
    expect(screen.getByText(/add notes…/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notes/i })).toBeInTheDocument()
  })

  it('still saves on blur in a later edit after an earlier edit was cancelled with Escape', async () => {
    const onSave = vi.fn(async () => true)
    render(<NotesField value="Great light" onSave={onSave} />)

    // First edit: open, then cancel with Escape. In real browsers (Chrome/Safari),
    // removing a focused element from the DOM does not fire blur, so this must not
    // rely on the textarea's onBlur handler to reset the cancelled flag.
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    fireEvent.keyDown(screen.getByLabelText('Notes'), { key: 'Escape' })

    // Second edit: open again, change the text, and blur — this should save.
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: 'Great light, noisy street' } })
    fireEvent.blur(box)

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Great light, noisy street'))
  })
})
