'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'
import { toast } from 'sonner'
import { CheckCircle, RotateCcw } from 'lucide-react'

interface Props {
  proposalId: string
  signToken: string
  clientName: string
}

export default function SignatureCanvas({ proposalId, signToken, clientName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: 'rgba(20,23,22,1)',
      penColor: '#b8f04a',
      minWidth: 1.5,
      maxWidth: 3,
    })
    padRef.current = pad

    function resize() {
      const canvas = canvasRef.current!
      const ratio = window.devicePixelRatio ?? 1
      const data = pad.toData()
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')!
      ctx.scale(ratio, ratio)
      pad.clear()
      pad.fromData(data)
    }
    window.addEventListener('resize', resize)
    resize()
    return () => { window.removeEventListener('resize', resize); pad.off() }
  }, [])

  function clear() {
    padRef.current?.clear()
  }

  async function submit() {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) {
      toast.error('Please sign before submitting')
      return
    }
    setLoading(true)
    try {
      const signatureData = pad.toDataURL('image/png')
      // Bug 8 / Integration 24 — routes through the server so the installer
      // notification + client confirmation emails can be sent via Resend
      const res = await fetch('/api/proposals/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: signToken, event: 'signed', signatureData }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to submit signature')
      }
      setSigned(true)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit signature')
    } finally {
      setLoading(false)
    }
  }

  if (signed) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ background: 'var(--sc-surface)', border: '1px solid rgba(34,197,94,0.3)' }}>
        <CheckCircle size={32} style={{ color: '#22c55e', margin: '0 auto 12px' }} />
        <p className="text-sm font-medium mb-1" style={{ color: '#22c55e' }}>Proposal signed successfully</p>
        <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
          {clientName} — {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </p>
        <p className="text-xs mt-3" style={{ color: 'var(--sc-muted)' }}>Your installer will be notified. You may close this page.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-6" style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
      <h2 className="text-base mb-1" style={{ color: 'var(--sc-text)' }}>Sign proposal</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--sc-muted)' }}>Draw your signature in the box below</p>

      <div className="relative rounded overflow-hidden mb-4" style={{ border: '1px solid var(--sc-border-2)', height: 160 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
        <button onClick={clear}
          className="absolute top-2 right-2 p-1.5 rounded flex items-center gap-1 text-xs"
          style={{ background: 'var(--sc-surface)', color: 'var(--sc-muted)', border: '1px solid var(--sc-border)' }}>
          <RotateCcw size={11} /> Clear
        </button>
        <p className="absolute bottom-2 left-0 right-0 text-center text-xs pointer-events-none" style={{ color: 'var(--sc-border-2)' }}>
          Sign here
        </p>
      </div>

      <div className="flex items-start gap-2 mb-4">
        <input type="checkbox" id="agree" checked={agreed} onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5" style={{ accentColor: 'var(--sc-accent)' }} />
        <label htmlFor="agree" className="text-xs" style={{ color: 'var(--sc-muted)' }}>
          I, {clientName}, agree to the terms of this solar installation proposal and authorize the installer to proceed with the installation as specified.
        </label>
      </div>

      <button onClick={submit} disabled={loading || !agreed}
        className="w-full py-2.5 rounded text-sm font-medium disabled:opacity-40 transition-opacity"
        style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
        {loading ? 'Submitting…' : 'Sign & Submit'}
      </button>
    </div>
  )
}
