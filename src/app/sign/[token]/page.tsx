import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInstallerProposalNotification } from '@/lib/email'
import { notFound } from 'next/navigation'
import SignatureCanvas from '@/components/esignature/SignatureCanvas'

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, project:projects(*, client:clients(*))')
    .eq('sign_token', token)
    .single()

  if (!proposal) notFound()

  // Mark as viewed + notify installer (Integration 24 / Bug 8). This page is
  // unauthenticated, so RLS blocks the clients → users join needed for the
  // installer's email — use the service-role admin client (Integration 28).
  if (!proposal.viewed_at) {
    try {
      const admin = createAdminClient()
      await admin.from('proposals').update({ viewed_at: new Date().toISOString() }).eq('id', proposal.id)

      const { data: full } = await admin
        .from('proposals')
        .select('project:projects(id, client:clients(name, installer:users(name, email)))')
        .eq('id', proposal.id)
        .single()
      const installer = (full?.project as any)?.client?.installer
      if (installer?.email) {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
        await sendInstallerProposalNotification({
          to: installer.email,
          installerName: installer.name ?? '',
          clientName: (full?.project as any)?.client?.name ?? '',
          event: 'viewed',
          projectUrl: `${appUrl}/projects/${(full?.project as any)?.id}`,
        })
      }
    } catch (err) {
      console.error('Failed to record proposal view / notify installer:', err)
    }
  }

  const project = proposal.project
  const client = project?.client

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: 'var(--sc-bg)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded" style={{ background: 'var(--sc-accent)' }} />
          <span className="text-base font-medium" style={{ fontFamily: 'Fraunces, serif', color: 'var(--sc-text)' }}>SolarCalc</span>
        </div>

        <div className="rounded-lg p-6 mb-6" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <h1 className="text-xl mb-1" style={{ color: 'var(--sc-text)' }}>Solar Installation Proposal</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--sc-muted)' }}>For {client?.name} · {client?.address}</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              ['System size', `${project?.system_size_kwp} kWp`],
              ['Panel count', `${project?.panel_count} panels`],
              ['Annual output', `${project?.annual_output_kwh?.toLocaleString()} kWh`],
              ['Total cost', `€${project?.total_cost?.toLocaleString()}`],
              ['Annual savings', `€${project?.annual_savings?.toLocaleString()}`],
              ['Payback period', `${project?.payback_years} years`],
            ].map(([label, value]) => (
              <div key={label} className="rounded p-3" style={{ background: 'var(--sc-surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--sc-muted)' }}>{label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>{value}</p>
              </div>
            ))}
          </div>

          {proposal.pdf_url && (
            <a href={proposal.pdf_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm mb-6"
              style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
              📄 View full proposal PDF
            </a>
          )}
        </div>

        {proposal.signed_at ? (
          <div className="rounded-lg p-6 text-center" style={{ background: 'var(--sc-surface)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <div className="text-2xl mb-2">✓</div>
            <p className="text-sm font-medium" style={{ color: '#22c55e' }}>Proposal signed</p>
            <p className="text-xs mt-1" style={{ color: 'var(--sc-muted)' }}>
              Signed on {new Date(proposal.signed_at).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <SignatureCanvas proposalId={proposal.id} signToken={token} clientName={client?.name ?? ''} />
        )}
      </div>
    </div>
  )
}
