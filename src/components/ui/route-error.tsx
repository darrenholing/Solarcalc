'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// Feature 23 — shared error-boundary UI for app router error.tsx files.
// Next.js requires error boundaries to be client components.
export default function RouteError({ error, reset, label = 'page' }: { error: Error & { digest?: string }; reset: () => void; label?: string }) {
  useEffect(() => {
    console.error(`Error rendering ${label}:`, error)
  }, [error, label])

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,92,92,0.12)' }}>
        <AlertTriangle size={20} style={{ color: 'var(--sc-red, #ff5c5c)' }} />
      </div>
      <h2 className="text-base font-medium mb-1" style={{ color: 'var(--sc-text)' }}>Something went wrong loading this {label}</h2>
      <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--sc-muted)' }}>
        {error?.message || 'An unexpected error occurred. You can try again, or head back and retry from there.'}
      </p>
      <button onClick={() => reset()}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
        style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
        <RotateCcw size={14} /> Try again
      </button>
    </div>
  )
}
