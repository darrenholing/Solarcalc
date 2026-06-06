'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Pencil, X } from 'lucide-react'
import { calculateSystem } from '@/lib/calculator'
import { Market, Project, Client } from '@/types'

const inputStyle = { background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }

// Feature 17 — project edit mode. Editing roof/panel parameters re-runs the
// full financial model (lib/calculator) so cost, savings, payback, CO₂ offset,
// and the monthly output chart all stay consistent with the new inputs.
export default function ProjectEditForm({ project, client, market }: { project: Project; client: Client; market: Market }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    panel_wattage: String(project.panel_wattage ?? ''),
    roof_orientation: String(project.roof_orientation ?? ''),
    roof_tilt: String(project.roof_tilt ?? ''),
    roof_area_m2: String(project.roof_area_m2 ?? ''),
    notes: project.notes ?? '',
  })

  function set<K extends keyof typeof form>(field: K, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()

      const results = calculateSystem({
        monthly_usage: client.monthly_usage,
        tariff: client.tariff,
        roof_orientation: parseFloat(form.roof_orientation) || 0,
        roof_tilt: parseFloat(form.roof_tilt) || 0,
        panel_wattage: parseFloat(form.panel_wattage) || 0,
        system_losses: 14,
        roof_area_m2: form.roof_area_m2 ? parseFloat(form.roof_area_m2) : undefined,
        market,
      })

      const { error } = await supabase.from('projects').update({
        panel_wattage: parseFloat(form.panel_wattage) || 0,
        roof_orientation: parseFloat(form.roof_orientation) || 0,
        roof_tilt: parseFloat(form.roof_tilt) || 0,
        roof_area_m2: form.roof_area_m2 ? parseFloat(form.roof_area_m2) : null,
        notes: form.notes || null,
        system_size_kwp: results.system_size_kwp,
        panel_count: results.panel_count,
        annual_output_kwh: results.annual_output_kwh,
        monthly_output: results.monthly_output,
        payback_years: results.payback_years,
        annual_savings: results.annual_savings,
        co2_offset_kg: results.co2_offset_kg,
        btw_amount: results.btw_amount ?? null,
        total_cost: results.total_cost,
      }).eq('id', project.id)

      if (error) throw error
      toast.success('Project updated and financials recalculated')
      setEditing(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
        <Pencil size={12} /> Edit project
      </button>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto py-12 px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs" style={{ color: 'var(--sc-muted)' }}>EDIT PROJECT — recalculates financials on save</h3>
              <button onClick={() => setEditing(false)} style={{ color: 'var(--sc-muted)' }}><X size={14} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Panel wattage (W)</label>
                  <input type="number" value={form.panel_wattage} onChange={e => set('panel_wattage', e.target.value)} required
                    className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Roof orientation (°)</label>
                  <input type="number" value={form.roof_orientation} onChange={e => set('roof_orientation', e.target.value)} required
                    className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Roof tilt (°)</label>
                  <input type="number" value={form.roof_tilt} onChange={e => set('roof_tilt', e.target.value)} required
                    className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Roof area (m²)</label>
                <input type="number" value={form.roof_area_m2} onChange={e => set('roof_area_m2', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <button type="submit" disabled={loading}
                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
                {loading ? 'Recalculating…' : 'Save & recalculate'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
