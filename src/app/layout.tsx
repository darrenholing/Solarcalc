import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'SolarCalc — Solar Installer Platform',
  description: 'Professional solar design, CRM, and monitoring for solar installers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" style={{ colorScheme: 'dark' }}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* UI 39 — single Toaster mounted globally; replaces console.error/silent failures */}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
