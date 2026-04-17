import { render, screen, fireEvent } from '@testing-library/react'
import { EditableCell } from '../EditableCell'

describe('EditableCell two-click behaviour', () => {
  it('does not enter edit mode when isSelected is false', () => {
    render(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={false}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByText('hello'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('enters edit mode when isSelected is true', () => {
    render(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={true}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByText('hello'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('does not enter edit mode when editable is false even if isSelected is true', () => {
    render(
      <EditableCell
        value="hello"
        format="text"
        editable={false}
        align="left"
        isSelected={true}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByText('hello'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows hover class only when isSelected and editable', () => {
    const { rerender } = render(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={false}
        onSave={() => {}}
      />
    )
    const span = screen.getByText('hello')
    expect(span.className).not.toContain('hover:border-dashed')

    rerender(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={true}
        onSave={() => {}}
      />
    )
    expect(screen.getByText('hello').className).toContain('hover:border-dashed')
  })
})
