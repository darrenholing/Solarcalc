'use client'

import { useState } from 'react'
import { CalculatorInputs, CalculatorResults, Market } from '@/types'
import { calculateSystem } from '@/lib/calculator'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Zap, Leaf, Clock, Euro, Sun, BatteryCharging } from 'lucide-react'

const ORIENTATIONS = [
  { label: 'N', value: 0 }, { label: 'NE', value: 45 }, { label: 'E', value: 90 },
  { label: 'SE', value: 135 }, { label: 'S', value: 180 }, { label: 'SW', value: 225 },
  { label: 'W', value: 270 }, { label: 'NW', value: 315 },
]
const PANEL_OPTIONS = [370, 390, 400, 410, 420, 430, 440, 450, 470, 500, 550]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(n: number, market: Market) {
  return market === 'NL' ? `€${n.toLocaleString()}` : `R${n.toLocaleString()}`
}

interface Props {
  market: Market
  onSave?: (inputs: CalculatorInputs, results: CalculatorResults) => void
  initialInputs?: Partial<CalculatorInputs>
  // South Africa market support — average weekly load-shedding hours for this
  // client (from clients.avg_loadshedding_hours), used to size a recommended
  // battery backup. Only rendered for ZA installers.
  avgLoadsheddingHours?: number | null
}

export default function SystemCalculator({ market, onSave, initialInputs, avgLoadsheddingHours }: Props) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    monthly_usage: initialInputs?.monthly_usage ?? 350,
    tariff: initialInputs?.tariff ?? (market === 'NL' ? 0.32 : 2.85),
    roof_orientation: initialInputs?.roof_orientation ?? 180,
    roof_tilt: initialInputs?.roof_tilt ?? 35,
    panel_wattage: initialInputs?.panel_wattage ?? 410,
    system_losses: initialInputs?.system_losses ?? 14,
    market,
  })

  const results = calculateSystem(inputs)

  function set(field: keyof CalculatorInputs, value: number) {
    setInputs(i => ({ ...i, [field]: value }))
  }

  const chartData = MONTHS.map((m, i) => ({
    month: m,
    production: results.monthly_output[i],
    usage: Math.round(inputs.monthly_usage),
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="rounded-lg p-5 space-y-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <h3 className="text-sm font-medium" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono, monospace' }}>INPUT PARAMETERS</h3>

          <Field label="Monthly usage (kWh)" value={inputs.monthly_usage} onChange={v => set('monthly_usage', v)}
            min={50} max={2000} step={10} unit="kWh" />
          <Field label={`Electricity tariff (${market === 'NL' ? '€' : 'R'}/kWh)`} value={inputs.tariff}
            onChange={v => set('tariff', v)} min={0.05} max={market === 'NL' ? 0.60 : 5} step={0.01} unit={market === 'NL' ? '€' : 'R'} decimals={2} />
          <Field label="Roof tilt (°)" value={inputs.roof_tilt} onChange={v => set('roof_tilt', v)} min={0} max={60} step={1} unit="°" />

          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--sc-muted)' }}>Roof orientation</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ORIENTATIONS.map(o => (
                <button key={o.value} onClick={() => set('roof_orientation', o.value)}
                  className="py-1.5 rounded text-xs transition-colors"
                  style={{
                    background: inputs.roof_orientation === o.value ? 'var(--sc-accent)' : 'var(--sc-surface-2)',
                    color: inputs.roof_orientation === o.value ? 'var(--sc-bg)' : 'var(--sc-muted)',
                    border: '1px solid var(--sc-border)',
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--sc-muted)' }}>Panel wattage</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PANEL_OPTIONS.map(w => (
                <button key={w} onClick={() => set('panel_wattage', w)}
                  className="py-1.5 rounded text-xs transition-colors"
                  style={{
                    background: inputs.panel_wattage === w ? 'var(--sc-accent)' : 'var(--sc-surface-2)',
                    color: inputs.panel_wattage === w ? 'var(--sc-bg)' : 'var(--sc-muted)',
                    border: '1px solid var(--sc-border)',
                  }}>
                  {w}W
                </button>
              ))}
            </div>
          </div>

          <Field label="System losses (%)" value={inputs.system_losses} onChange={v => set('system_losses', v)}
            min={5} max={30} step={1} unit="%" />

          {onSave && (
            <button
              onClick={() => onSave(inputs, results)}
              className="w-full py-2.5 rounded text-sm font-medium transition-opacity"
              style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}
            >
              Save to project
            </button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Zap size={14} />} label="System size" value={`${results.system_size_kwp} kWp`} accent />
            <StatCard icon={<Sun size={14} />} label="Panel count" value={`${results.panel_count} panels`} />
            <StatCard icon={<TrendingUp size={14} />} label="Annual output" value={`${results.annual_output_kwh.toLocaleString()} kWh`} />
            <StatCard icon={<Clock size={14} />} label="Payback period" value={`${results.payback_years} years`} />
            <StatCard icon={<Euro size={14} />} label="Annual savings" value={fmt(results.annual_savings, market)} accent />
            <StatCard icon={<TrendingUp size={14} />} label="25-year returns" value={fmt(results.returns_25yr, market)} />
            <StatCard icon={<Leaf size={14} />} label="CO₂ offset/yr" value={`${(results.co2_offset_kg / 1000).toFixed(1)} tonnes`} />
            <StatCard icon={<Zap size={14} />} label="Self-sufficiency" value={`${results.self_sufficiency}%`} />
          </div>

          {market === 'ZA' && !!avgLoadsheddingHours && avgLoadsheddingHours > 0 && (
            <LoadSheddingCard monthlyUsage={inputs.monthly_usage} hours={avgLoadsheddingHours} />
          )}

          {market === 'NL' && (
            <div className="rounded-lg p-4 space-y-1" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
              <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>System cost breakdown (NL)</p>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--sc-text)' }}>Base cost</span>
                <span style={{ color: 'var(--sc-text)' }}>{fmt(results.total_cost - (results.btw_amount ?? 0), market)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--sc-muted)' }}>BTW (21%)</span>
                <span style={{ color: 'var(--sc-muted)' }}>{fmt(results.btw_amount ?? 0, market)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-1 border-t" style={{ borderColor: 'var(--sc-border)', color: 'var(--sc-accent)' }}>
                <span>Total incl. BTW</span>
                <span>{fmt(results.total_cost, market)}</span>
              </div>
              {results.system_size_kwp > 15 && (
                <p className="text-xs mt-2 px-2 py-1 rounded" style={{ background: 'var(--sc-accent-bg)', color: 'var(--sc-accent)' }}>
                  ⚡ System over 15 kWp — eligible for SDE++ subsidy
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Monthly production chart */}
      <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <h3 className="text-xs mb-4" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono, monospace' }}>MONTHLY PRODUCTION vs USAGE (kWh)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barGap={2}>
            <XAxis dataKey="month" tick={{ fill: 'var(--sc-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--sc-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', borderRadius: 6, fontSize: 12, fontFamily: 'DM Mono' }}
              labelStyle={{ color: 'var(--sc-muted)' }}
              itemStyle={{ color: 'var(--sc-text)' }}
            />
            <Bar dataKey="production" name="Production" fill="var(--sc-accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="usage" name="Usage" fill="var(--sc-border-2)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--sc-muted)' }}>
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'var(--sc-accent)' }} /> Production
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--sc-muted)' }}>
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'var(--sc-border-2)' }} /> Usage
          </span>
        </div>
      </div>
    </div>
  )
}

// South Africa market support — load-shedding-aware battery backup sizing.
// Heuristic: cover the client's average hourly load during an outage window
// with a 20% buffer (inverter/DoD losses), rounded up to the nearest 0.5 kWh,
// with a sensible 2.5 kWh floor for small households.
function LoadSheddingCard({ monthlyUsage, hours }: { monthlyUsage: number; hours: number }) {
  const hourlyUsageKwh = monthlyUsage / 30 / 24
  const rawCapacity = hourlyUsageKwh * hours * 1.2
  const recommendedKwh = Math.max(2.5, Math.ceil(rawCapacity * 2) / 2)
  const stagesNote = hours <= 8
    ? 'Stage 1–2 level outages'
    : hours <= 16
    ? 'Stage 3–4 level outages'
    : 'Stage 5+ level outages'

  return (
    <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--sc-surface)', border: '1px solid rgba(184,240,74,0.2)' }}>
      <div className="flex items-center gap-1.5" style={{ color: 'var(--sc-accent)' }}>
        <BatteryCharging size={14} />
        <p className="text-xs font-medium">Load-shedding battery recommendation</p>
      </div>
      <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
        Based on ~{hours} hrs/week of average outages ({stagesNote}) and this client&apos;s usage profile.
      </p>
      <div className="flex justify-between text-sm pt-1">
        <span style={{ color: 'var(--sc-text)' }}>Recommended battery capacity</span>
        <span className="font-medium" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono, monospace' }}>{recommendedKwh} kWh</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
        Sized to cover essential loads through an outage window with a 20% buffer for inverter and depth-of-discharge losses. Confirm against the client&apos;s critical-circuit list before quoting.
      </p>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--sc-surface)', border: `1px solid ${accent ? 'rgba(184,240,74,0.2)' : 'var(--sc-border)'}` }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: accent ? 'var(--sc-accent)' : 'var(--sc-muted)' }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-base font-medium" style={{ color: accent ? 'var(--sc-accent)' : 'var(--sc-text)', fontFamily: 'DM Mono, monospace' }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, min, max, step, unit, decimals = 0 }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; unit: string; decimals?: number
}) {
  // UI 31 — keep a free-text buffer so users can clear/retype the number
  // input without the slider snapping the value back mid-edit. Re-sync that
  // buffer when `value` changes externally (e.g. slider drag) by adjusting
  // state during render — the recommended alternative to setState-in-effect,
  // since it avoids an extra cascading render.
  const format = (v: number) => (decimals > 0 ? v.toFixed(decimals) : String(v))
  const [text, setText] = useState(format(value))
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(format(value))
  }

  function commit(raw: string) {
    const n = parseFloat(raw)
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <label className="text-xs" style={{ color: 'var(--sc-muted)' }}>{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            min={min} max={max} step={step}
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="sc-slider-number w-20 px-2 py-1 rounded text-xs text-right outline-none"
            style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-accent)', fontFamily: 'DM Mono, monospace' }}
          />
          {unit !== '€' && unit !== 'R' && (
            <span className="text-xs" style={{ color: 'var(--sc-muted)' }}>{unit}</span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="sc-slider w-full"
      />
    </div>
  )
}
