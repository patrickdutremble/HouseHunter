import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeReturnTo } from '@/lib/safe-return-to'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnTo = safeReturnTo(searchParams.get('returnTo'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${returnTo}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error)
  } else {
    console.error('[auth/callback] missing code parameter')
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`)
}
