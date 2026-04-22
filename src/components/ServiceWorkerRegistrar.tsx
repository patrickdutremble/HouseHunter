'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently ignore — SW failure must not block the app.
    })
  }, [])
  return null
}
