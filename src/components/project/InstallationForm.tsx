'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plug, ChevronDown, ChevronUp } from 'lucide-react'

const inputStyle = { background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }

interface Installation {
  id: string
  installed_at: string
  inverter_type: 'victron' | 'solaredge' | 'other'
  monitoring_api_key?: string | null
  system_id?: string | null
}

// Feature 12 — installation record creation form on the project detail page.
// Once a record exists it links straight through to monitoring instead of
// re-showing the form.
export default function InstallationForm({ projectId, installation }: { projectId: string; installation: Installation | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(!installation)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    installed_at: installation?.installed_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    inverter_type: installation?.inverter_type ?? 'victron',
    monitoring_api_key: installation?.monitoring_api_key ?? '',
    system_id: installation?.system_id ?? '',
  })

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        project_id: projectId,
        installed_at: form.installed_at,
        inverter_type: form.inverter_type,
        monitoring_api_key: form.monitoring_api_key || null,
        system_id: form.system_id || null,
      }
      const { error } = installation
        ? await supabase.from('installations').update(payload).eq('id', installation.id)
        : await supabase.from('installations').insert(payload)
      if (error) throw error
      toast.success(installation ? 'Installation record updated' : 'Installation record created')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save installation record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <h3 className="text-xs flex items-center gap-2" style={{ color: 'var(--sc-muted)' }}>
          <Plug size={13} /> {installation ? 'INSTALLATION RECORD' : 'ADD INSTALLATION RECORD'}
        </h3>
        {open ? <ChevronUp size={14} style={{ color: 'var(--sc-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--sc-muted)' }} />}
      </button>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Installation date</label>
              <input type="date" value={form.installed_at} onChange={e => set('installed_at', e.target.value)} required
                className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Inverter type</label>
              <select value={form.inverter_type} onChange={e => set('inverter_type', e.target.value as Installation['inverter_type'])}
                className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle}>
                <option value="victron">Victron</option>
                <option value="solaredge">SolarEdge</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>Monitoring API key</label>
            <input type="text" value={form.monitoring_api_key} onChange={e => set('monitoring_api_key', e.target.value)}
              placeholder="e.g. VRM API token / SolarEdge API key"
              className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--sc-muted)' }}>System / installation ID</label>
            <input type="text" value={form.system_id} onChange={e => set('system_id', e.target.value)}
              placeholder="e.g. VRM site ID / SolarEdge site ID"
              className="w-full px-3 py-2 rounded text-sm outline-none" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
            {loading ? 'Saving…' : installation ? 'Update record' : 'Create installation record'}
          </button>
        </form>
      )}
    </div>
  )
}
