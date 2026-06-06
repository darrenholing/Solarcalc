'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

// UI 39 — single Toaster instance mounted in the root layout. Styled to match
// SolarCalc's dark surface palette via CSS variables already defined in globals.css.
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      richColors
      toastOptions={{
        classNames: {
          toast: 'group toast',
        },
        style: {
          background: 'var(--sc-surface)',
          border: '1px solid var(--sc-border)',
          color: 'var(--sc-text)',
        },
      }}
      {...props}
    />
  )
}
