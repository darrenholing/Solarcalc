'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Market, Client } from '@/types'

const inputStyle = { background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }

// Feature 16 — client edit page with every field editable, including the
// South Africa-specific load-shedding average used by the SA calculator.
export default function ClientEditForm({ client, market }: { client: Client; market: Market }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: client.name ?? '',
    address: client.address ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    monthly_usage: String(client.monthly_usage ?? ''),
    tariff: String(client.tariff ?? ''),
    avg_loadshedding_hours: String(client.avg_loadshedding_hours ?? ''),
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      name: form.name,
      address: form.address,
      email: form.email || null,
      phone: form.phone || null,
      monthly_usage: parseFloat(form.monthly_usage) || 0,
      tariff: parseFloat(form.tariff) || 0,
    }
    if (market === 'ZA') {
      payload.avg_loadshedding_hours = parseFloat(form.avg_loadshedding_hours) || 0
    }
    const { error } = await supabase.from('clients').update(payload).eq('id', client.id)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      toast.success('Client updated')
      router.push(`/clients/${client.id}`)
      router.refresh()
    }
  }

  const tariffUnit = market === 'NL' ? '€/kWh' : 'R/kWh'

  const fields: Array<{ label: string; field: keyof typeof form; required: boolean; placeholder: string; type?: string }> = [
    { label: 'Full name', field: 'name', required: true, placeholder: 'Jan de Vries' },
    { label: 'Address', field: 'address', required: true, placeholder: 'Keizersgracht 1, Amsterdam' },
    { label: 'Email', field: 'email', required: false, placeholder: 'jan@email.com' },
    { label: 'Phone', field: 'phone', required: false, placeholder: '+31 6 12345678' },
    { label: 'Monthly usage (kWh)', field: 'monthly_usage', required: true, placeholder: '350', type: 'number' },
    { label: `Electricity tariff (${tariffUnit})`, field: 'tariff', required: true, placeholder: '0.32', type: 'number' },
  ]
  if (market === 'ZA') {
    fields.push({ label: 'Average load-shedding (hours/day)', field: 'avg_loadshedding_hours', required: false, placeholder: '4', type: 'number' })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(({ label, field, required, placeholder, type }) => (
        <div key={field}>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>{label}</label>
          <input
            type={type ?? 'text'}
            value={form[field]}
            onChange={e => set(field, e.target.value)}
            required={required}
            placeholder={placeholder}
            step={type === 'number' ? 'any' : undefined}
            className="w-full px-3 py-2.5 rounded text-sm outline-none"
            style={inputStyle}
          />
        </div>
      ))}

      {error && <p className="text-xs" style={{ color: 'var(--sc-red)' }}>{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={() => router.push(`/clients/${client.id}`)}
          className="px-4 py-2.5 rounded text-sm font-medium"
          style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
