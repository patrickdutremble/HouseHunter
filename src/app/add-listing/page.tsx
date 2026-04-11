import { Suspense } from 'react'
import { AddListingClient } from './AddListingClient'

export default function AddListingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-400 text-sm">Loading...</div>
        </div>
      }
    >
      <AddListingClient />
    </Suspense>
  )
}
