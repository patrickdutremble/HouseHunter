import { render, screen, fireEvent } from '@testing-library/react'
import { LocationCell } from '../LocationCell'

describe('LocationCell two-click behaviour', () => {
  it('does not enter edit mode when isSelected is false', () => {
    render(
      <LocationCell
        text="123 Main St"
        mapQuery="123 Main St"
        editable
        isSelected={false}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('enters edit mode when isSelected is true', () => {
    render(
      <LocationCell
        text="123 Main St"
        mapQuery="123 Main St"
        editable
        isSelected={true}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
