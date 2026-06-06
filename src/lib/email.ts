import { Resend } from 'resend'

// Integration 24 / Bug 8 — single reusable Resend wrapper used for every
// outbound email: signing links, e-signature confirmations, and installer
// notifications on view/sign events.

const FROM = process.env.RESEND_FROM_EMAIL ?? 'SolarCalc <proposals@solarcalc.app>'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error('RESEND_API_KEY is not configured — email not sent')
    return null
  }
  return new Resend(key)
}

interface SendEmailArgs {
  to: string
  subject: string
  html: string
}

async function sendEmail({ to, subject, html }: SendEmailArgs) {
  const resend = getResend()
  if (!resend) return { error: 'RESEND_API_KEY missing' }

  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) console.error('Resend send error:', error)
  return { data, error }
}

function shell(title: string, bodyHtml: string) {
  return `
  <div style="background:#0d0f0e;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#141716;border:1px solid #2a302c;border-radius:12px;overflow:hidden;">
      <div style="background:#1a1f1c;padding:20px 28px;border-left:4px solid #b8f04a;">
        <span style="color:#b8f04a;font-size:18px;font-weight:700;letter-spacing:-0.02em;">SolarCalc</span>
      </div>
      <div style="padding:28px;color:#e8ede9;">
        <h1 style="font-size:18px;margin:0 0 16px;color:#e8ede9;">${title}</h1>
        ${bodyHtml}
      </div>
      <div style="background:#1a1f1c;padding:14px 28px;border-left:4px solid #b8f04a;">
        <span style="color:#8a9490;font-size:11px;">Sent by SolarCalc · solar installer platform</span>
      </div>
    </div>
  </div>`
}

function button(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:#b8f04a;color:#0d0f0e;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px;margin:8px 0 16px;">${label}</a>`
}

// Bug 8 / Feature 15 — proposal signing link sent to the client
export async function sendProposalSigningLinkEmail(opts: {
  to: string
  clientName: string
  installerName: string
  installerCompany: string
  signingUrl: string
}) {
  const { to, clientName, installerName, installerCompany, signingUrl } = opts
  const html = shell('Your solar proposal is ready to review', `
    <p style="color:#c5cdc8;font-size:14px;line-height:1.6;">Hi ${clientName},</p>
    <p style="color:#c5cdc8;font-size:14px;line-height:1.6;">
      ${installerCompany} has prepared your solar installation proposal. Click below to review the
      full system design, financials, and to sign electronically.
    </p>
    ${button('Review &amp; sign proposal', signingUrl)}
    <p style="color:#8a9490;font-size:12px;line-height:1.6;">
      Or copy this link into your browser:<br/>
      <span style="color:#b8f04a;word-break:break-all;">${signingUrl}</span>
    </p>
    <p style="color:#8a9490;font-size:12px;margin-top:20px;">— ${installerName}, ${installerCompany}</p>
  `)
  return sendEmail({ to, subject: `${installerCompany}: your solar proposal is ready to sign`, html })
}

// e-signature confirmation back to the client
export async function sendSignatureConfirmationEmail(opts: {
  to: string
  clientName: string
  installerCompany: string
}) {
  const { to, clientName, installerCompany } = opts
  const html = shell('Proposal signed — thank you', `
    <p style="color:#c5cdc8;font-size:14px;line-height:1.6;">Hi ${clientName},</p>
    <p style="color:#c5cdc8;font-size:14px;line-height:1.6;">
      We've received your signed proposal. ${installerCompany} will be in touch shortly to schedule
      your installation.
    </p>
  `)
  return sendEmail({ to, subject: `Proposal signed — ${installerCompany}`, html })
}

// Installer notification when a client views or signs a proposal
export async function sendInstallerProposalNotification(opts: {
  to: string
  installerName: string
  clientName: string
  event: 'viewed' | 'signed'
  projectUrl: string
}) {
  const { to, installerName, clientName, event, projectUrl } = opts
  const verb = event === 'viewed' ? 'viewed' : 'signed'
  const html = shell(`${clientName} just ${verb} their proposal`, `
    <p style="color:#c5cdc8;font-size:14px;line-height:1.6;">Hi ${installerName},</p>
    <p style="color:#c5cdc8;font-size:14px;line-height:1.6;">
      ${clientName} has ${verb} the proposal you sent them.
    </p>
    ${button('Open project', projectUrl)}
  `)
  return sendEmail({ to, subject: `${clientName} ${verb} their proposal`, html })
}
