import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { FileText, Send, CheckCircle, Clock, Eye } from 'lucide-react'

export default async function ProposalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, project:projects(*, client:clients(*))')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>Proposals</h1>
        <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>{proposals?.length ?? 0} proposals</p>
      </div>

      {proposals && proposals.length > 0 ? (
        <div className="space-y-2">
          {proposals.map(p => {
            const status = p.signed_at ? 'signed' : p.viewed_at ? 'viewed' : p.sent_at ? 'sent' : 'draft'
            return (
              <Link key={p.id} href={`/proposals/${p.id}`}>
                <div className="flex items-center justify-between p-4 rounded-lg transition-colors"
                  style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
                  <div className="flex items-center gap-3">
                    <StatusIcon status={status} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--sc-text)' }}>{p.project?.client?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
                        {p.project?.system_size_kwp} kWp · {p.project?.client?.address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={status} />
                    <p className="text-xs mt-1" style={{ color: 'var(--sc-muted)' }}>
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-24" style={{ color: 'var(--sc-muted)' }}>
          <p className="mb-2">No proposals yet</p>
          <p className="text-xs">Generate a proposal from a project to get started</p>
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    draft: <FileText size={16} style={{ color: 'var(--sc-muted)' }} />,
    sent: <Send size={16} style={{ color: '#60a5fa' }} />,
    viewed: <Eye size={16} style={{ color: '#f59e0b' }} />,
    signed: <CheckCircle size={16} style={{ color: '#22c55e' }} />,
  }
  return <>{icons[status] ?? icons.draft}</>
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'var(--sc-muted)' },
    sent: { label: 'Sent', color: '#60a5fa' },
    viewed: { label: 'Viewed', color: '#f59e0b' },
    signed: { label: 'Signed', color: '#22c55e' },
  }
  const { label, color } = config[status] ?? config.draft
  return <span className="text-xs" style={{ color }}>{label}</span>
}
