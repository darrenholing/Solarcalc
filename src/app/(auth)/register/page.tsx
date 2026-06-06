'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', company: '', email: '', password: '', market: 'NL' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        name: form.name,
        company: form.company,
        email: form.email,
        market: form.market,
        subscription_tier: 'free',
      })
    }
    router.push('/calculator')
    router.refresh()
  }

  const inputStyle = { background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sc-bg)' }}>
      <div className="w-full max-w-md px-6 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded" style={{ background: 'var(--sc-accent)' }} />
            <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Fraunces, serif', color: 'var(--sc-text)' }}>SolarCalc</span>
          </div>
          <h1 className="text-2xl mb-2" style={{ color: 'var(--sc-text)' }}>Create your account</h1>
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>Start with 5 free proposals per month</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {[
            { label: 'Full name', field: 'name', type: 'text', placeholder: 'Jan de Vries' },
            { label: 'Company', field: 'company', type: 'text', placeholder: 'SolarPro BV' },
            { label: 'Email', field: 'email', type: 'email', placeholder: 'jan@solarpro.nl' },
            { label: 'Password', field: 'password', type: 'password', placeholder: '••••••••' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>{label}</label>
              <input
                type={type}
                value={(form as any)[field]}
                onChange={e => update(field, e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded text-sm outline-none"
                style={inputStyle}
                placeholder={placeholder}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Market</label>
            <select
              value={form.market}
              onChange={e => update('market', e.target.value)}
              className="w-full px-3 py-2.5 rounded text-sm outline-none"
              style={inputStyle}
            >
              <option value="NL">Netherlands (EUR)</option>
              <option value="ZA">South Africa (ZAR)</option>
            </select>
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--sc-red)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--sc-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" className="underline" style={{ color: 'var(--sc-accent)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
