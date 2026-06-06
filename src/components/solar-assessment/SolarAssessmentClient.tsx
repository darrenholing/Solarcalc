'use client'

import { useState } from 'react'
import { Search, Loader, Sun, MapPin, TrendingUp, Info } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface NasaResult {
  monthly: number[]
  annualAvg: number
  location: { lat: number; lng: number; name: string }
  meta: { source: string; period: string; parameter: string; units: string }
}

// Custom tooltip that matches SolarCalc's dark design system
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const value: number = payload[0]?.value ?? 0
  return (
    <div className="rounded px-3 py-2 text-xs" style={{
      background: 'var(--sc-surface-2)',
      border: '1px solid var(--sc-border)',
      fontFamily: 'DM Mono, monospace',
    }}>
      <p style={{ color: 'var(--sc-muted)' }}>{label}</p>
      <p style={{ color: 'var(--sc-accent)' }}>{value.toFixed(2)} kWh/m²/day</p>
    </div>
  )
}

export default function SolarAssessmentClient() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<NasaResult | null>(null)

  async function runAssessment() {
    if (!address.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      // Step 1 — geocode via the existing server-side proxy
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address.trim())}`)
      const geoJson = await geoRes.json()
      if (!geoRes.ok || geoJson.error) throw new Error(geoJson.error ?? 'Address not found')

      const { lat, lng, formatted_address } = geoJson

      // Step 2 — fetch NASA POWER irradiance data
      const nasaRes = await fetch(`/api/nasa-power?lat=${lat}&lng=${lng}`)
      const nasaJson = await nasaRes.json()
      if (!nasaRes.ok || nasaJson.error) throw new Error(nasaJson.error ?? 'NASA POWER API error')

      setResult({
        ...nasaJson,
        location: { ...nasaJson.location, name: formatted_address ?? nasaJson.location.name },
      })
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') runAssessment()
  }

  const chartData = result
    ? result.monthly.map((value, i) => ({ month: MONTHS[i], value }))
    : []

  const annualAvg = result?.annualAvg ?? 0
  const peak = result ? Math.max(...result.monthly) : 0
  const trough = result ? Math.min(...result.monthly.filter(v => v > 0)) : 0
  const peakMonth = result ? MONTHS[result.monthly.indexOf(peak)] : ''
  const troughMonth = result
    ? MONTHS[result.monthly.findIndex(v => v === trough)]
    : ''

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <label className="block text-xs mb-2" style={{ color: 'var(--sc-muted)' }}>
          PROPERTY ADDRESS
        </label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded"
            style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
            <MapPin size={14} style={{ color: 'var(--sc-muted)', flexShrink: 0 }} />
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. Herengracht 182, Amsterdam or Cape Town, South Africa"
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: 'var(--sc-text)' }}
              autoFocus
            />
          </div>
          <button
            onClick={runAssessment}
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium disabled:opacity-50 shrink-0"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
            {loading
              ? <><Loader size={14} className="animate-spin" /> Analysing…</>
              : <><Search size={14} /> Analyse</>}
          </button>
        </div>
        {error && (
          <div className="mt-3 px-3 py-2 rounded text-xs" style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            color: '#f87171',
          }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Location + annual headline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Annual average — hero stat */}
            <div className="md:col-span-1 rounded-lg p-5 flex flex-col justify-between"
              style={{ background: 'var(--sc-accent-bg)', border: '1px solid rgba(184,240,74,0.25)' }}>
              <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--sc-accent)' }}>
                <Sun size={14} />
                <span className="text-xs font-medium">Annual average</span>
              </div>
              <div>
                <p className="text-4xl font-bold leading-none" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono, monospace' }}>
                  {annualAvg.toFixed(2)}
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--sc-muted)' }}>kWh/m²/day</p>
              </div>
              <div className="mt-4 pt-4 border-t text-xs space-y-1" style={{ borderColor: 'rgba(184,240,74,0.15)', color: 'var(--sc-muted)' }}>
                <p>Peak: <strong style={{ color: 'var(--sc-text)' }}>{peak.toFixed(2)} kWh/m²/day</strong> ({peakMonth})</p>
                <p>Low: <strong style={{ color: 'var(--sc-text)' }}>{trough.toFixed(2)} kWh/m²/day</strong> ({troughMonth})</p>
              </div>
            </div>

            {/* Location + meta */}
            <div className="md:col-span-2 rounded-lg p-5 space-y-4"
              style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--sc-muted)' }}>LOCATION</p>
                <p className="text-sm font-medium" style={{ color: 'var(--sc-text)' }}>{result.location.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono, monospace' }}>
                  {result.location.lat.toFixed(5)}°, {result.location.lng.toFixed(5)}°
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Season spread', value: `${(peak - trough).toFixed(2)} kWh/m²/day`, sub: 'peak vs trough' },
                  {
                    label: 'Peak sun hours',
                    value: `${(annualAvg * 365).toFixed(0)} h/yr`,
                    sub: 'annual total',
                  },
                  {
                    label: 'Est. yield (1 kWp)',
                    value: `${Math.round(annualAvg * 365 * 0.82)} kWh/yr`,
                    sub: 'incl. 18% system losses',
                  },
                  {
                    label: 'Irradiance quality',
                    value: annualAvg >= 5 ? 'Excellent' : annualAvg >= 4 ? 'Good' : annualAvg >= 3 ? 'Moderate' : 'Low',
                    sub: annualAvg >= 5 ? '≥ 5 kWh/m²/day' : annualAvg >= 4 ? '4–5 kWh/m²/day' : annualAvg >= 3 ? '3–4 kWh/m²/day' : '< 3 kWh/m²/day',
                  },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="rounded p-3"
                    style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--sc-muted)' }}>{label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono, monospace' }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--sc-muted)' }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-xs font-medium mb-0.5" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono, monospace' }}>
                  MONTHLY SOLAR IRRADIANCE (kWh/m²/day)
                </h2>
                <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
                  3-year average · dashed line = annual mean
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--sc-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'var(--sc-accent)' }} />
                  kWh/m²/day
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="25%">
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--sc-muted)', fontSize: 11, fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--sc-muted)', fontSize: 11, fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'dataMax + 0.5']}
                  tickFormatter={v => v.toFixed(1)}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <ReferenceLine
                  y={annualAvg}
                  stroke="rgba(184,240,74,0.4)"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: `avg ${annualAvg.toFixed(2)}`,
                    fill: 'var(--sc-muted)',
                    fontSize: 10,
                    fontFamily: 'DM Mono',
                    position: 'insideTopRight',
                  }}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.value >= annualAvg ? 'var(--sc-accent)' : 'var(--sc-border-2, #3a4040)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Month value table */}
            <div className="mt-4 grid grid-cols-6 md:grid-cols-12 gap-1">
              {chartData.map(({ month, value }) => (
                <div key={month} className="text-center">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono' }}>{month}</p>
                  <p className="text-xs font-medium" style={{
                    color: value >= annualAvg ? 'var(--sc-accent)' : 'var(--sc-text)',
                    fontFamily: 'DM Mono',
                  }}>
                    {value.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Data source */}
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-xs"
            style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)', color: 'var(--sc-muted)' }}>
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--sc-muted)' }} />
            <p>
              <strong style={{ color: 'var(--sc-text)' }}>Data source:</strong>{' '}
              {result.meta.source} · {result.meta.period} · {result.meta.parameter} · {result.meta.units}.
              {' '}Values represent all-sky (cloud-corrected) conditions. Use for preliminary sizing only — on-site measurement recommended for final design.
            </p>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="rounded-lg p-10 flex flex-col items-center gap-4 text-center"
          style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--sc-accent-bg)' }}>
            <Sun size={24} style={{ color: 'var(--sc-accent)' }} />
          </div>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--sc-text)' }}>
              Enter any address to get started
            </p>
            <p className="text-xs max-w-sm" style={{ color: 'var(--sc-muted)' }}>
              Works worldwide — Netherlands, South Africa, or anywhere else.
              Data comes from NASA's POWER dataset (2020–2022 average).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
            {[
              'Herengracht 182, Amsterdam',
              'Buitenkant St, Cape Town',
              'Sandton City, Johannesburg',
              'Rotterdam Central Station',
            ].map(ex => (
              <button key={ex} onClick={() => { setAddress(ex); }}
                className="px-3 py-2 rounded text-xs text-left transition-colors"
                style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-muted)' }}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
