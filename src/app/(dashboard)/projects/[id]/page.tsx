import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Zap, TrendingUp, Leaf, Clock, Euro } from 'lucide-react'
import { Market } from '@/types'
import GenerateProposalButton from '@/components/proposal/GenerateProposalButton'
import InstallationForm from '@/components/project/InstallationForm'
import StageUpdater from '@/components/project/StageUpdater'
import ProjectEditForm from '@/components/project/ProjectEditForm'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: profile }, { data: installation }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', id).single(),
    supabase.from('users').select('*').eq('id', user!.id).single(),
    supabase.from('installations').select('*').eq('project_id', id).maybeSingle(),
  ])

  if (!project) notFound()

  const market = (profile?.market as Market) ?? 'NL'
  const currency = market === 'NL' ? '€' : 'R'

  const stats = [
    { label: 'System size', value: `${project.system_size_kwp} kWp`, icon: <Zap size={14} /> },
    { label: 'Panel count', value: `${project.panel_count} panels`, icon: <Zap size={14} /> },
    { label: 'Annual output', value: `${project.annual_output_kwh.toLocaleString()} kWh`, icon: <TrendingUp size={14} /> },
    { label: 'Total cost', value: `${currency}${project.total_cost.toLocaleString()}`, icon: <Euro size={14} /> },
    { label: 'Annual savings', value: `${currency}${project.annual_savings.toLocaleString()}`, icon: <TrendingUp size={14} /> },
    { label: 'Payback period', value: `${project.payback_years} years`, icon: <Clock size={14} /> },
    { label: 'CO₂ offset/yr', value: `${(project.co2_offset_kg / 1000).toFixed(1)} tonnes`, icon: <Leaf size={14} /> },
  ]

  const systemParams: Array<[string, string]> = [
    ['Panel wattage', `${project.panel_wattage}W`],
    ['Roof tilt', `${project.roof_tilt}°`],
    ['Roof orientation', `${project.roof_orientation}°`],
  ]
  if (project.roof_area_m2) systemParams.push(['Roof area', `${project.roof_area_m2} m²`])
  if (market === 'NL' && project.btw_amount) systemParams.push(['BTW (21%)', `€${project.btw_amount}`])

  const clientParams: Array<[string, string]> = []
  if (project.client?.email) clientParams.push(['Email', project.client.email])
  if (project.client?.phone) clientParams.push(['Phone', project.client.phone])
  clientParams.push(['Monthly usage', `${project.client?.monthly_usage} kWh`])
  clientParams.push(['Tariff', `${currency}${project.client?.tariff}/kWh`])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/projects" className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-80 transition-opacity" style={{ color: 'var(--sc-muted)' }}>
        <ArrowLeft size={14} /> Back to projects
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>{project.client?.name}</h1>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--sc-muted)' }}>
            <MapPin size={13} /> {project.client?.address}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StageUpdater projectId={project.id} stage={project.stage} />
          <ProjectEditForm project={project} client={project.client} market={market} />
          <GenerateProposalButton project={project} installer={profile} market={market} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--sc-muted)' }}>
              {s.icon}
              <span className="text-xs">{s.label}</span>
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <InstallationForm projectId={project.id} installation={installation ?? null} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <h3 className="text-xs mb-4" style={{ color: 'var(--sc-muted)' }}>SYSTEM PARAMETERS</h3>
          <dl className="space-y-2">
            {systemParams.map(([label, value]) => (
              <KV key={label} label={label} value={value} />
            ))}
          </dl>
        </div>
        <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <h3 className="text-xs mb-4" style={{ color: 'var(--sc-muted)' }}>CLIENT DETAILS</h3>
          <dl className="space-y-2">
            {clientParams.map(([label, value]) => (
              <KV key={label} label={label} value={value} />
            ))}
          </dl>
          {project.notes && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--sc-border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--sc-muted)' }}>Notes</p>
              <p className="text-sm" style={{ color: 'var(--sc-text)' }}>{project.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt style={{ color: 'var(--sc-muted)' }}>{label}</dt>
      <dd style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>{value}</dd>
    </div>
  )
}
