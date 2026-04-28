'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function UserMenu() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setEmail(data.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setEmail(session?.user?.email ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  if (!email) return null

  async function handleLogout() {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="fixed top-3 right-3 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-md bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {email}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
