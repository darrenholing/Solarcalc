'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/calculator')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sc-bg)' }}>
      <div className="w-full max-w-md px-6">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded" style={{ background: 'var(--sc-accent)' }} />
            <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Fraunces, serif', color: 'var(--sc-text)' }}>SolarCalc</span>
          </div>
          <h1 className="text-2xl mb-2" style={{ color: 'var(--sc-text)' }}>Welcome back</h1>
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>Sign in to your installer account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded text-sm outline-none focus:ring-1"
              style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)', '--tw-ring-color': 'var(--sc-accent)' } as React.CSSProperties}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded text-sm outline-none"
              style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--sc-red)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--sc-muted)' }}>
          No account?{' '}
          <Link href="/register" className="underline" style={{ color: 'var(--sc-accent)' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
