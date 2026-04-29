'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeReturnTo } from '@/lib/safe-return-to'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))

  const [stage, setStage] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendHint, setResendHint] = useState(false)
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearResendTimer() {
    if (resendTimerRef.current) {
      clearTimeout(resendTimerRef.current)
      resendTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => clearResendTimer()
  }, [])

  const supabase = createClient()

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (error) {
      setError("This email isn't authorized, or we couldn't send the code right now. Wait a minute and try again, or contact Patrick if you should have access.")
      return
    }
    setStage('otp')
    clearResendTimer()
    resendTimerRef.current = setTimeout(() => setResendHint(true), 30000)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError("That code didn't match. Try again or request a new one.")
      return
    }
    router.push(returnTo)
    router.refresh()
  }

  function resetToEmail() {
    clearResendTimer()
    setStage('email')
    setCode('')
    setError(null)
    setResendHint(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to HouseHunter</h1>
          <p className="text-sm text-slate-500 mt-1">
            {stage === 'email'
              ? "Enter your email and we'll send you a 6-digit code."
              : `We sent a code to ${email}.`}
          </p>
        </div>

        {stage === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-base"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-base font-mono tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
            <div className="flex items-center justify-between text-sm pt-2">
              <button
                type="button"
                onClick={resetToEmail}
                className="text-slate-500 hover:text-slate-700 underline"
              >
                Use a different email
              </button>
              {resendHint && (
                <button
                  type="button"
                  onClick={() => sendCode({ preventDefault: () => {} } as React.FormEvent)}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Send a new code
                </button>
              )}
            </div>
            {resendHint && (
              <p className="text-xs text-slate-400 mt-2">
                Didn&apos;t get it? Check your spam folder.
              </p>
            )}
          </form>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  )
}
