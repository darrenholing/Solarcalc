import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, MapPin, Mail, Phone, Zap } from 'lucide-react'
import RoofAssessment from '@/components/satellite/RoofAssessment'
import { Market } from '@/types'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: client }, { data: profile }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('users').select('market').eq('id', user!.id).single(),
    supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
  ])

  if (!client) notFound()

  const market = (profile?.market as Market) ?? 'NL'
  const currency = market === 'NL' ? '€' : 'R'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/clients" className="flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--sc-muted)' }}>
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl mb-2" style={{ color: 'var(--sc-text)' }}>{client.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--sc-muted)' }}>
            <span className="flex items-center gap-1.5"><MapPin size={13} />{client.address}</span>
            {client.email && <span className="flex items-center gap-1.5"><Mail size={13} />{client.email}</span>}
            {client.phone && <span className="flex items-center gap-1.5"><Phone size={13} />{client.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/clients/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
            style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
            <Pencil size={14} /> Edit
          </Link>
          <Link href={`/clients/${id}/new-project`}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
            <Plus size={14} /> New project
          </Link>
        </div>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg p-4" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--sc-muted)' }}>Monthly usage</p>
          <p className="text-lg font-medium" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>{client.monthly_usage} kWh</p>
        </div>
        <div className="rounded-lg p-4" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--sc-muted)' }}>Electricity tariff</p>
          <p className="text-lg font-medium" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>{currency}{client.tariff}/kWh</p>
        </div>
      </div>

      {/* Satellite roof assessment */}
      <div className="mb-6">
        <h2 className="text-sm mb-3" style={{ color: 'var(--sc-muted)' }}>ROOF ASSESSMENT</h2>
        <RoofAssessment address={client.address} clientId={client.id} projectId={projects?.[0]?.id} />
      </div>

      {/* Projects */}
      <div>
        <h2 className="text-sm mb-3" style={{ color: 'var(--sc-muted)' }}>PROJECTS</h2>
        {projects && projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--sc-surface-2)', color: 'var(--sc-muted)' }}>{p.stage.replace('_', ' ')}</span>
                    <span className="text-sm" style={{ color: 'var(--sc-text)' }}>{p.system_size_kwp} kWp — {p.panel_count} panels</span>
                  </div>
                  <span className="text-sm" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>{currency}{p.total_cost.toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>No projects yet</p>
        )}
      </div>
    </div>
  )
}
