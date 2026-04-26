import { Suspense } from 'react'
import { AddListingClient } from './AddListingClient'

export default function AddListingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-bg">
          <div className="text-fg-subtle text-sm">Loading...</div>
        </div>
      }
    >
      <AddListingClient />
    </Suspense>
  )
}
