const PUBLIC_EXACT_PATHS = new Set<string>([
  '/login',
  '/auth/callback',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/bookmarklet.html',
])

const PUBLIC_PREFIXES = [
  '/_next/',
  '/api/cron/',
]

const PUBLIC_FILE_PATTERN = /^\/icon-[a-z0-9-]+\.(png|svg|ico)$/

export function shouldGate(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return false
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return false
  }
  if (PUBLIC_FILE_PATTERN.test(pathname)) return false
  return true
}
