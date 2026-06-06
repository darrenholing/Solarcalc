import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInstallerProposalNotification, sendSignatureConfirmationEmail } from '@/lib/email'

// Public endpoint hit from the unauthenticated /sign/[token] page when a
// client views or signs a proposal. Uses the service-role admin client
// (Integration 28) because the action needs to read the installer's email
// across the clients → users join, which RLS rightly blocks for anonymous
// visitors — and to fire the Resend notifications (Integration 24 / Bug 8).
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, event, signatureData } = body as { token: string; event: 'viewed' | 'signed'; signatureData?: string }

  if (!token || !event) return NextResponse.json({ error: 'token and event required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: proposal } = await admin
    .from('proposals')
    .select('*, project:projects(*, client:clients(*, installer:users(*)))')
    .eq('sign_token', token)
    .single()

  if (!proposal) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const client = proposal.project?.client
  const installer = client?.installer
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, '')
  const projectUrl = `${appUrl}/projects/${proposal.project_id}`

  if (event === 'viewed') {
    if (!proposal.viewed_at) {
      await admin.from('proposals').update({ viewed_at: new Date().toISOString() }).eq('id', proposal.id)
      if (installer?.email) {
        await sendInstallerProposalNotification({
          to: installer.email,
          installerName: installer.name ?? '',
          clientName: client?.name ?? '',
          event: 'viewed',
          projectUrl,
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (event === 'signed') {
    if (!signatureData) return NextResponse.json({ error: 'signatureData required' }, { status: 400 })

    await admin.from('proposals').update({
      signed_at: new Date().toISOString(),
      signature_data: signatureData,
    }).eq('id', proposal.id)
    await admin.from('projects').update({ signed_at: new Date().toISOString() }).eq('id', proposal.project_id)

    if (installer?.email) {
      await sendInstallerProposalNotification({
        to: installer.email,
        installerName: installer.name ?? '',
        clientName: client?.name ?? '',
        event: 'signed',
        projectUrl,
      })
    }
    if (client?.email) {
      await sendSignatureConfirmationEmail({
        to: client.email,
        clientName: client.name ?? '',
        installerCompany: installer?.company ?? 'SolarCalc',
      })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown event' }, { status: 400 })
}
