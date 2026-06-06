import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Send, Eye, CheckCircle, ExternalLink } from 'lucide-react'
import { Market } from '@/types'
import CopySigningLink from '@/components/proposal/CopySigningLink'

// Feature 13 — proposal detail page: status, PDF preview, signing link with
// copy button, signature image, and the view/sign/send timeline.
export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: proposal }, { data: profile }] = await Promise.all([
    supabase.from('proposals').select('*, project:projects(*, client:clients(*))').eq('id', id).single(),
    supabase.from('users').select('market').eq('id', user!.id).single(),
  ])

  if (!proposal) notFound()

  const market = (profile?.market as Market) ?? 'NL'
  const currency = market === 'NL' ? '€' : 'R'
  const project = proposal.project
  const client = project?.client

  const status = proposal.signed_at ? 'signed' : proposal.viewed_at ? 'viewed' : proposal.sent_at ? 'sent' : 'draft'

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const signingUrl = proposal.sign_token ? `${appUrl}/sign/${proposal.sign_token}` : null

  const timeline: Array<{ label: string; at?: string | null; icon: React.ReactNode; color: string }> = [
    { label: 'Generated', at: proposal.created_at, icon: <FileText size={14} />, color: 'var(--sc-muted)' },
    { label: 'Sent to client', at: proposal.sent_at, icon: <Send size={14} />, color: '#60a5fa' },
    { label: 'Viewed by client', at: proposal.viewed_at, icon: <Eye size={14} />, color: '#f59e0b' },
    { label: 'Signed', at: proposal.signed_at, icon: <CheckCircle size={14} />, color: '#22c55e' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/proposals" className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-80 transition-opacity" style={{ color: 'var(--sc-muted)' }}>
        <ArrowLeft size={14} /> Back to proposals
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>{client?.name}</h1>
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>{client?.address}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          ['System size', `${project?.system_size_kwp} kWp`],
          ['Panel count', `${project?.panel_count} panels`],
          ['Total cost', `${currency}${project?.total_cost?.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg p-3" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
            <p className="text-xs mb-0.5" style={{ color: 'var(--sc-muted)' }}>{label}</p>
            <p className="text-sm font-medium" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* PDF preview / link */}
      <div className="rounded-lg p-5 mb-6" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <h3 className="text-xs mb-3" style={{ color: 'var(--sc-muted)' }}>PROPOSAL PDF</h3>
        {proposal.pdf_url ? (
          <div className="space-y-3">
            <a href={proposal.pdf_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm"
              style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
              <FileText size={14} /> Open PDF <ExternalLink size={12} />
            </a>
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--sc-border)', height: 480 }}>
              <iframe src={proposal.pdf_url} className="w-full h-full" title="Proposal PDF preview" />
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>No PDF generated yet — generate one from the project page.</p>
        )}
      </div>

      {/* Signing link */}
      {signingUrl && (
        <div className="rounded-lg p-5 mb-6" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <h3 className="text-xs mb-3" style={{ color: 'var(--sc-muted)' }}>SIGNING LINK</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="text-xs px-3 py-2 rounded flex-1 min-w-0 truncate" style={{ background: 'var(--sc-surface-2)', color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>
              {signingUrl}
            </code>
            <CopySigningLink url={signingUrl} />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-lg p-5 mb-6" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
        <h3 className="text-xs mb-4" style={{ color: 'var(--sc-muted)' }}>TIMELINE</h3>
        <div className="space-y-3">
          {timeline.map(t => (
            <div key={t.label} className="flex items-center gap-3 text-sm">
              <span style={{ color: t.at ? t.color : 'var(--sc-border-2)' }}>{t.icon}</span>
              <span style={{ color: t.at ? 'var(--sc-text)' : 'var(--sc-muted)' }}>{t.label}</span>
              <span className="ml-auto text-xs" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono' }}>
                {t.at ? new Date(t.at).toLocaleString(market === 'ZA' ? 'en-ZA' : 'nl-NL') : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Signature */}
      {proposal.signature_data && (
        <div className="rounded-lg p-5" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
          <h3 className="text-xs mb-3" style={{ color: 'var(--sc-muted)' }}>CLIENT SIGNATURE</h3>
          <div className="rounded overflow-hidden inline-block" style={{ border: '1px solid var(--sc-border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proposal.signature_data} alt={`${client?.name}'s signature`} style={{ display: 'block', maxWidth: 400, background: 'rgba(20,23,22,1)' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'var(--sc-muted)' },
    sent: { label: 'Sent', color: '#60a5fa' },
    viewed: { label: 'Viewed', color: '#f59e0b' },
    signed: { label: 'Signed', color: '#22c55e' },
  }
  const { label, color } = config[status] ?? config.draft
  return (
    <span className="px-2.5 py-1 rounded text-xs font-medium" style={{ background: `${color}20`, color }}>
      {label}
    </span>
  )
}
