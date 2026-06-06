'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewClientPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', address: '', email: '', phone: '', monthly_usage: '', tariff: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('clients').insert({
      installer_id: user!.id,
      name: form.name,
      address: form.address,
      email: form.email || null,
      phone: form.phone || null,
      monthly_usage: parseFloat(form.monthly_usage) || 0,
      tariff: parseFloat(form.tariff) || 0,
    }).select().single()
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(`/clients/${data.id}`)
    }
  }

  const inputStyle = { background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/clients" className="flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--sc-muted)' }}>
        <ArrowLeft size={14} /> Back to clients
      </Link>
      <h1 className="text-2xl mb-6" style={{ color: 'var(--sc-text)' }}>New client</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: 'Full name', field: 'name', required: true, placeholder: 'Jan de Vries' },
          { label: 'Address', field: 'address', required: true, placeholder: 'Keizersgracht 1, Amsterdam' },
          { label: 'Email', field: 'email', required: false, placeholder: 'jan@email.com' },
          { label: 'Phone', field: 'phone', required: false, placeholder: '+31 6 12345678' },
          { label: 'Monthly usage (kWh)', field: 'monthly_usage', required: true, placeholder: '350' },
          { label: 'Electricity tariff (€/kWh)', field: 'tariff', required: true, placeholder: '0.32' },
        ].map(({ label, field, required, placeholder }) => (
          <div key={field}>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>{label}</label>
            <input
              type="text"
              value={(form as any)[field]}
              onChange={e => set(field, e.target.value)}
              required={required}
              placeholder={placeholder}
              className="w-full px-3 py-2.5 rounded text-sm outline-none"
              style={inputStyle}
            />
          </div>
        ))}

        {error && <p className="text-xs" style={{ color: 'var(--sc-red)' }}>{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
          {loading ? 'Creating…' : 'Create client'}
        </button>
      </form>
    </div>
  )
}
