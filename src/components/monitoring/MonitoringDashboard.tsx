'use client'

import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Zap, TrendingUp, Sun, Activity, RefreshCw } from 'lucide-react'

interface Installation {
  id: string
  inverter_type: string
  monitoring_api_key?: string
  system_id?: string
  project?: {
    system_size_kwp: number
    annual_output_kwh: number
    client?: { name: string; address: string }
  }
}

type Period = 'day' | 'week' | 'month'

interface Props {
  installations: Installation[]
}

export default function MonitoringDashboard({ installations }: Props) {
  const [selected, setSelected] = useState<Installation | null>(installations[0] ?? null)
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [liveW, setLiveW] = useState<number | null>(null)

  useEffect(() => {
    if (!selected) return
    fetchData(selected, period)
  }, [selected, period])

  async function fetchData(inst: Installation, p: Period) {
    setLoading(true)
    try {
      const res = await fetch(`/api/monitoring?id=${inst.id}&period=${p}`)
      const json = await res.json()
      setData(json.data ?? [])
      setLiveW(json.live_watts ?? null)
    } finally {
      setLoading(false)
    }
  }

  if (installations.length === 0) {
    return (
      <div className="text-center py-24" style={{ color: 'var(--sc-muted)' }}>
        <Activity size={32} className="mx-auto mb-3 opacity-40" />
        <p className="mb-1">No monitored installations yet</p>
        <p className="text-xs">Mark a project as Closed Won and add an installation to start monitoring</p>
      </div>
    )
  }

  const kwp = selected?.project?.system_size_kwp ?? 0
  const expectedDaily = kwp * 3.5 // avg daily kWh estimate

  return (
    <div className="space-y-5">
      {/* Installation selector */}
      <div className="flex gap-2 flex-wrap">
        {installations.map(inst => (
          <button key={inst.id} onClick={() => setSelected(inst)}
            className="px-3 py-1.5 rounded text-xs transition-colors"
            style={{
              background: selected?.id === inst.id ? 'var(--sc-accent-bg)' : 'var(--sc-surface)',
              border: `1px solid ${selected?.id === inst.id ? 'rgba(184,240,74,0.3)' : 'var(--sc-border)'}`,
              color: selected?.id === inst.id ? 'var(--sc-accent)' : 'var(--sc-muted)',
            }}>
            {inst.project?.client?.name} — {inst.project?.system_size_kwp} kWp
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Live stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Live output', value: liveW != null ? `${(liveW / 1000).toFixed(2)} kW` : '—', icon: <Zap size={13} />, accent: true },
              { label: 'System size', value: `${kwp} kWp`, icon: <Sun size={13} /> },
              { label: 'Est. daily output', value: `${expectedDaily.toFixed(1)} kWh`, icon: <TrendingUp size={13} /> },
              { label: 'Inverter type', value: selected.inverter_type, icon: <Activity size={13} /> },
            ].map(({ label, value, icon, accent }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: 'var(--sc-surface)', border: `1px solid ${accent ? 'rgba(184,240,74,0.2)' : 'var(--sc-border)'}` }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: accent ? 'var(--sc-accent)' : 'var(--sc-muted)' }}>
                  {icon}<span className="text-xs">{label}</span>
                </div>
                <div className="text-sm font-medium" style={{ color: accent ? 'var(--sc-accent)' : 'var(--sc-text)', fontFamily: 'DM Mono' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs" style={{ color: 'var(--sc-muted)' }}>PRODUCTION vs EXPECTED</h3>
              <div className="flex items-center gap-2">
                {(['day', 'week', 'month'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className="px-2.5 py-1 rounded text-xs transition-colors"
                    style={{
                      background: period === p ? 'var(--sc-accent)' : 'var(--sc-surface-2)',
                      color: period === p ? 'var(--sc-bg)' : 'var(--sc-muted)',
                    }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
                <button onClick={() => fetchData(selected, period)} className="p-1.5 rounded" style={{ color: 'var(--sc-muted)' }}>
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {data && data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="prod" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--sc-accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--sc-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: 'var(--sc-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--sc-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} unit=" kWh" />
                  <Tooltip contentStyle={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', borderRadius: 6, fontSize: 12, fontFamily: 'DM Mono' }} />
                  <Area type="monotone" dataKey="actual" name="Actual" stroke="var(--sc-accent)" fill="url(#prod)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="expected" name="Expected" stroke="var(--sc-border-2)" fill="none" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center" style={{ color: 'var(--sc-muted)' }}>
                {loading ? 'Loading data…' : 'No data available — connect monitoring API in settings'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
