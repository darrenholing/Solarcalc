'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { PipelineStage } from '@/types'

const STAGES: Array<{ value: PipelineStage; label: string; color: string }> = [
  { value: 'lead', label: 'Lead', color: '#60a5fa' },
  { value: 'qualified', label: 'Qualified', color: '#a78bfa' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'var(--sc-accent)' },
  { value: 'site_survey', label: 'Site Survey', color: '#f59e0b' },
  { value: 'closed_won', label: 'Closed Won', color: '#22c55e' },
  { value: 'closed_lost', label: 'Closed Lost', color: '#ff5c5c' },
]

// Feature 19 — lets installers move a project through the pipeline directly
// from the project detail page (mirrors the Kanban drag-and-drop).
export default function StageUpdater({ projectId, stage }: { projectId: string; stage: PipelineStage }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const current = STAGES.find(s => s.value === stage) ?? STAGES[0]

  async function update(next: PipelineStage) {
    if (next === stage) { setOpen(false); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('projects').update({ stage: next }).eq('id', projectId)
      if (error) throw error
      toast.success(`Stage updated to ${STAGES.find(s => s.value === next)?.label}`)
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update stage')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50"
        style={{ background: `${current.color}20`, color: current.color }}>
        {current.label} <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 rounded-lg overflow-hidden min-w-[160px]"
            style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
            {STAGES.map(s => (
              <button key={s.value} onClick={() => update(s.value)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:opacity-80 transition-opacity"
                style={{ color: s.value === stage ? s.color : 'var(--sc-text)', background: s.value === stage ? `${s.color}15` : 'transparent' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
