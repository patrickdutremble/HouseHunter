import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - common static files (favicons, icons, sw, manifest, bookmarklet)
     * The shouldGate() function inside updateSession() handles fine-grained
     * rules including auth/* and api/cron/* exemptions.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|icon-.*\\.png|icon-.*\\.svg|icon-.*\\.ico|bookmarklet\\.html).*)',
  ],
}
