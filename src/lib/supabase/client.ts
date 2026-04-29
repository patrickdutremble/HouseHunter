import { createBrowserClient } from '@supabase/ssr'

// Direct property access so Next.js inlines these into the browser bundle.
// `?? ''` keeps the type as `string`; the empty-string check below validates
// at module load that the build did receive the env vars.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY at build time. ' +
    'These must be set in the deployment environment so Next.js can inline them into the browser bundle.'
  )
}

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
