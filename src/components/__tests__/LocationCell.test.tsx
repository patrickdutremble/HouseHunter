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

describe('LocationCell thumbnail', () => {
  it('renders the listing image when imageUrl is provided', () => {
    render(
      <LocationCell
        text="Montréal"
        mapQuery="Montréal"
        editable
        imageUrl="https://example.com/house.jpg"
        onSave={() => {}}
      />
    )
    const img = screen.getByRole('img') as HTMLImageElement
    expect(decodeURIComponent(img.src)).toContain('https://example.com/house.jpg')
  })

  it('renders a placeholder icon when imageUrl is null', () => {
    const { container } = render(
      <LocationCell
        text="Montréal"
        mapQuery="Montréal"
        editable
        imageUrl={null}
        onSave={() => {}}
      />
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('falls back to the placeholder when the image fails to load', () => {
    const { container } = render(
      <LocationCell
        text="Montréal"
        mapQuery="Montréal"
        editable
        imageUrl="https://example.com/broken.jpg"
        onSave={() => {}}
      />
    )
    const img = screen.getByRole('img') as HTMLImageElement
    fireEvent.error(img)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
