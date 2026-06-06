'use client'

import { useState } from 'react'
import { Copy, Check, FileText, Loader, Send } from 'lucide-react'
import { toast } from 'sonner'
import { generateProposalPDF } from '@/lib/proposal'
import { createClient } from '@/lib/supabase/client'
import { Market } from '@/types'
import { tierProposalLimit } from '@/lib/limits'

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days — proposals stay valid for 30 days, give buffer

interface Props {
  project: any
  installer: any
  market: Market
}

export default function GenerateProposalButton({ project, installer, market }: Props) {
  const [loading, setLoading] = useState(false)
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [signToken, setSignToken] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  const signingUrl = signToken ? `${appUrl}/sign/${signToken}` : null

  async function generate() {
    setLoading(true)
    try {
      const supabase = createClient()

      // Feature 14 — enforce the free-tier monthly proposal limit before generating
      const { data: profile } = await supabase
        .from('users')
        .select('subscription_tier, proposals_this_month')
        .eq('id', installer.id)
        .single()

      const limit = tierProposalLimit(profile?.subscription_tier ?? 'free')
      if (limit !== null && (profile?.proposals_this_month ?? 0) >= limit) {
        toast.error(`You've reached your free plan limit of ${limit} proposals this month. Upgrade to generate more.`)
        return
      }

      const pdfBlob = await generateProposalPDF({ project, installer, market })

      // Upload PDF to the private "proposals" bucket
      const fileName = `${installer.id}/${project.id}-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage.from('proposals').upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (uploadError) throw uploadError

      // Bug 5 — bucket is private; use a signed URL with a TTL instead of getPublicUrl
      const { data: signed, error: signError } = await supabase.storage
        .from('proposals')
        .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS)
      if (signError) throw signError

      // Bug 6 — unique(project_id) constraint (see migrations.sql) makes this upsert safe
      const { data: proposal, error: upsertError } = await supabase
        .from('proposals')
        .upsert({ project_id: project.id, pdf_url: signed?.signedUrl }, { onConflict: 'project_id' })
        .select()
        .single()
      if (upsertError) throw upsertError

      setProposalId(proposal?.id ?? null)
      // Feature 15 — surface the shareable signing link with a copy button
      setSignToken(proposal?.sign_token ?? null)
      setSent(!!proposal?.sent_at)

      // Feature 14 — increment the counter only after a successful generation
      await supabase
        .from('users')
        .update({ proposals_this_month: (profile?.proposals_this_month ?? 0) + 1 })
        .eq('id', installer.id)

      // Trigger download
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SolarCalc-Proposal-${project.client?.name?.replace(/\s/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Proposal generated and ready to share')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message ?? 'Failed to generate proposal')
    } finally {
      setLoading(false)
    }
  }

  // Bug 8 / Integration 24 — actually emails the signing link via Resend (server route)
  async function sendToClient() {
    if (!proposalId) return
    setLoading(true)
    try {
      const res = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      setSent(true)
      toast.success(`Signing link emailed to ${project.client?.email}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message ?? 'Could not send the proposal email')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!signingUrl) return
    await navigator.clipboard.writeText(signingUrl)
    setCopied(true)
    toast.success('Signing link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
          {loading ? <Loader size={12} className="animate-spin" /> : <FileText size={12} />}
          Generate PDF
        </button>
        {proposalId && !sent && (
          <button onClick={sendToClient} disabled={loading || !project.client?.email}
            title={!project.client?.email ? 'Client has no email address on file' : undefined}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
            <Send size={12} /> Send to client
          </button>
        )}
        {sent && <span className="text-xs" style={{ color: '#22c55e' }}>✓ Sent</span>}
      </div>

      {signingUrl && (
        <button onClick={copyLink}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-muted)' }}>
          {copied ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
          <span style={{ fontFamily: 'DM Mono' }}>{copied ? 'Copied' : 'Copy signing link'}</span>
        </button>
      )}
    </div>
  )
}
