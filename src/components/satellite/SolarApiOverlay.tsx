'use client'

import { useState } from 'react'
import { Loader, Sun, Zap, TrendingUp, Clock } from 'lucide-react'
import { BuildingInsights } from '@/types'

interface Props {
  address: string
  center: { lat: number; lng: number } | null
}

export default function SolarApiOverlay({ address, center }: Props) {
  const [data, setData] = useState<BuildingInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchSolarData() {
    if (!center) {
      setError('Load the satellite map first to get coordinates')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/solar?lat=${center.lat}&lng=${center.lng}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Solar API error')
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <div className="p-8 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--sc-accent-bg)' }}>
          <Sun size={20} style={{ color: 'var(--sc-accent)' }} />
        </div>
        <div className="text-center">
          <p className="text-sm mb-1" style={{ color: 'var(--sc-text)' }}>Google Solar API Analysis</p>
          <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
            3D roof modelling, shade analysis, and optimal panel placement using Google&apos;s solar data layer
          </p>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--sc-red)' }}>{error}</p>}
        <button onClick={fetchSolarData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
          {loading ? <Loader size={14} className="animate-spin" /> : <Sun size={14} />}
          {loading ? 'Analysing roof…' : 'Run solar analysis'}
        </button>
      </div>
    )
  }

  const sp = data.solar_potential
  const topSegments = sp.roof_segment_stats.sort((a, b) => b.yearly_energy_dc_kwh - a.yearly_energy_dc_kwh).slice(0, 5)
  const totalEnergy = sp.roof_segment_stats.reduce((s, seg) => s + seg.yearly_energy_dc_kwh, 0)

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs" style={{ color: 'var(--sc-muted)' }}>SOLAR POTENTIAL ANALYSIS</h3>
        <button onClick={() => setData(null)} className="text-xs" style={{ color: 'var(--sc-muted)' }}>Reset</button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Max panels', value: sp.max_array_panels_count.toString(), icon: <Zap size={13} /> },
          { label: 'Roof area', value: `${sp.max_array_area_meters2.toFixed(0)} m²`, icon: <Sun size={13} /> },
          { label: 'Peak sun hours', value: `${sp.max_sunshine_hours_per_year.toFixed(0)} h/yr`, icon: <Clock size={13} /> },
          { label: 'CO₂ factor', value: `${sp.carbon_offset_factor_kg_per_mwh} kg/MWh`, icon: <TrendingUp size={13} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded p-3" style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--sc-muted)' }}>
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Roof segments */}
      <div>
        <h4 className="text-xs mb-3" style={{ color: 'var(--sc-muted)' }}>ROOF SEGMENTS (top by production)</h4>
        <div className="space-y-2">
          {topSegments.map((seg, i) => {
            const pct = (seg.yearly_energy_dc_kwh / totalEnergy) * 100
            const azLabel = azimuthLabel(seg.azimuth_degrees)
            return (
              <div key={i} className="rounded p-3" style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--sc-surface)', color: 'var(--sc-muted)' }}>
                      {azLabel} {seg.pitch_degrees.toFixed(0)}°
                    </span>
                    <span className="text-xs" style={{ color: 'var(--sc-text)' }}>
                      {seg.yearly_energy_dc_kwh.toFixed(0)} kWh/yr
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono' }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--sc-border)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--sc-accent)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
        Data from Google Solar API · Building: {data.name}
      </p>
    </div>
  )
}

function azimuthLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}
