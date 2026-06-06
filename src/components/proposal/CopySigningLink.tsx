'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

// Feature 13/15 — small client island so the proposal detail page (a server
// component) can still offer a "copy signing link" action.
export default function CopySigningLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Signing link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
      style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-muted)' }}>
      {copied ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
      <span style={{ fontFamily: 'DM Mono' }}>{copied ? 'Copied' : 'Copy signing link'}</span>
    </button>
  )
}
