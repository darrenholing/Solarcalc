'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import LogoUpload from './LogoUpload'

interface Props {
  profile: any
  userId: string
}

const ZA_PROVINCES = ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape']

const TIERS = [
  { id: 'free', label: 'Free', description: '5 proposals/month', price: '€0' },
  { id: 'pro', label: 'Pro', description: 'Unlimited proposals, CRM, e-signature', price: '€99/mo' },
  { id: 'platform', label: 'Platform', description: 'Pro + monitoring, financing, marketplace', price: '€199/mo' },
]

export default function SettingsForm({ profile, userId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    company: profile?.company ?? '',
    market: profile?.market ?? 'NL',
    province: profile?.province ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    // South Africa market support — province drives the irradiance factor
    // table (Bug 9 / lib/irradiance.ts); clear it when switching back to NL
    await supabase.from('users').update({
      name: form.name,
      company: form.company,
      market: form.market,
      province: form.market === 'ZA' ? (form.province || null) : null,
    }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const inputStyle = { background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }

  return (
    <div className="space-y-8">
      {/* Profile */}
      <section className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <h2 className="text-xs mb-4" style={{ color: 'var(--sc-muted)' }}>PROFILE</h2>
        <div className="mb-5 pb-5 border-b" style={{ borderColor: 'var(--sc-border)' }}>
          <p className="text-xs mb-2.5" style={{ color: 'var(--sc-muted)' }}>Company logo</p>
          <LogoUpload userId={userId} logo={profile?.logo} />
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Full name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2.5 rounded text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Company</label>
              <input value={form.company} onChange={e => set('company', e.target.value)}
                className="w-full px-3 py-2.5 rounded text-sm outline-none" style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Market</label>
            <select value={form.market} onChange={e => set('market', e.target.value)}
              className="w-full px-3 py-2.5 rounded text-sm outline-none" style={inputStyle}>
              <option value="NL">Netherlands (EUR, BTW 21%)</option>
              <option value="ZA">South Africa (ZAR)</option>
            </select>
          </div>
          {form.market === 'ZA' && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Province</label>
              <select value={form.province} onChange={e => set('province', e.target.value)}
                className="w-full px-3 py-2.5 rounded text-sm outline-none" style={inputStyle}>
                <option value="">Select a province…</option>
                {ZA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="text-xs mt-1.5" style={{ color: 'var(--sc-muted)' }}>
                Drives the seasonal irradiance factors used in monitoring simulations and calculations (Southern Hemisphere solar patterns vary significantly by province).
              </p>
            </div>
          )}
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Subscription */}
      <section className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <h2 className="text-xs mb-4" style={{ color: 'var(--sc-muted)' }}>SUBSCRIPTION</h2>
        <div className="space-y-2">
          {TIERS.map(tier => {
            const active = profile?.subscription_tier === tier.id
            return (
              <div key={tier.id} className="flex items-center justify-between p-3 rounded" style={{
                background: active ? 'var(--sc-accent-bg)' : 'var(--sc-surface-2)',
                border: `1px solid ${active ? 'rgba(184,240,74,0.3)' : 'var(--sc-border)'}`,
              }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: active ? 'var(--sc-accent)' : 'var(--sc-text)' }}>{tier.label}</p>
                  <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>{tier.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>{tier.price}</p>
                  {active && <p className="text-xs" style={{ color: 'var(--sc-accent)' }}>Current plan</p>}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--sc-muted)' }}>
          To upgrade, contact hello@solarcalc.nl
        </p>
      </section>

      {/* Market info */}
      <section className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <h2 className="text-xs mb-3" style={{ color: 'var(--sc-muted)' }}>MARKET CONFIGURATION</h2>
        {form.market === 'NL' ? (
          <div className="space-y-1 text-xs" style={{ color: 'var(--sc-muted)' }}>
            <p>🇳🇱 <strong style={{ color: 'var(--sc-text)' }}>Netherlands</strong> — BTW 21% on installations</p>
            <p>Net metering policy: Saldering (until 2027)</p>
            <p>SDE++ subsidy flag for systems ≥ 15 kWp</p>
            <p>KNMI irradiance data</p>
            <p>Currency: EUR (€)</p>
          </div>
        ) : (
          <div className="space-y-1 text-xs" style={{ color: 'var(--sc-muted)' }}>
            <p>🇿🇦 <strong style={{ color: 'var(--sc-text)' }}>South Africa</strong> — No VAT on solar (Section 12B)</p>
            <p>Default municipal tariff: R2.85/kWh, escalating ~12% annually (Eskom-driven)</p>
            <p>NERSA-regulated tariffs vary by municipality — check local wheeling agreements before quoting</p>
            <p>Net billing / feed-in depends on your municipality&apos;s solar PV wheeling policy (no national net metering)</p>
            <p>Provincial irradiance data — set your province below for accurate seasonal output</p>
            <p>Average load-shedding hours (per client) feed the battery sizing recommendation</p>
            <p>Currency: ZAR (R)</p>
          </div>
        )}
      </section>
    </div>
  )
}
