'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, Trash2, Loader } from 'lucide-react'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

// UI 37 — logo upload: stores the file in the public `logos` bucket, writes
// the public URL to `users.logo`, and that URL is then embedded in generated
// proposal PDFs (see lib/proposal.ts → loadLogoDataUrl).
export default function LogoUpload({ userId, logo }: { userId: string; logo?: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(logo ?? null)

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, WebP, or SVG image')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Logo must be smaller than 2MB')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'png'
      const fileName = `${userId}/logo-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      })
      if (uploadError) throw uploadError

      // The "logos" bucket is public — proposal PDFs are generated client-side
      // and need a directly fetchable URL to embed the image (Bug 5 keeps the
      // *proposals* bucket private, but logos are meant to be shareable assets)
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(fileName)
      const url = pub.publicUrl

      const { error: updateError } = await supabase.from('users').update({ logo: url }).eq('id', userId)
      if (updateError) throw updateError

      setPreview(url)
      toast.success('Logo updated')
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to upload logo')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeLogo() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('users').update({ logo: null }).eq('id', userId)
      if (error) throw error
      setPreview(null)
      toast.success('Logo removed')
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove logo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Company logo" className="w-full h-full object-contain" />
        ) : (
          <Upload size={18} style={{ color: 'var(--sc-muted)' }} />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
          PNG, JPEG, WebP or SVG · max 2MB · shown on proposal PDFs
        </p>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-text)' }}>
            {loading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
            {preview ? 'Replace logo' : 'Upload logo'}
          </button>
          {preview && (
            <button type="button" onClick={removeLogo} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs disabled:opacity-50"
              style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)', color: 'var(--sc-red, #ff5c5c)' }}>
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
