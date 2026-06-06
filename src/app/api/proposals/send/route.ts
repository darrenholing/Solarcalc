import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendProposalSigningLinkEmail } from '@/lib/email'

// Bug 8 — "Send to client" now actually emails the signing link via Resend
export async function POST(request: NextRequest) {
  const { proposalId } = await request.json()
  if (!proposalId) return NextResponse.json({ error: 'proposalId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, project:projects(*, client:clients(*))')
    .eq('id', proposalId)
    .single()

  if (!proposal) return NextResponse.json({ error: 'proposal not found' }, { status: 404 })

  const client = proposal.project?.client
  if (!client?.email) {
    return NextResponse.json({ error: 'Client has no email address on file' }, { status: 400 })
  }

  const { data: installer } = await supabase.from('users').select('*').eq('id', user.id).single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const signingUrl = `${appUrl.replace(/\/$/, '')}/sign/${proposal.sign_token}`

  const { error } = await sendProposalSigningLinkEmail({
    to: client.email,
    clientName: client.name,
    installerName: installer?.name ?? '',
    installerCompany: installer?.company ?? 'SolarCalc',
    signingUrl,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to send email — check RESEND_API_KEY configuration' }, { status: 502 })
  }

  await supabase.from('proposals').update({ sent_at: new Date().toISOString() }).eq('id', proposalId)
  await supabase.from('projects').update({ stage: 'proposal_sent' }).eq('id', proposal.project_id)

  return NextResponse.json({ ok: true, signingUrl })
}
