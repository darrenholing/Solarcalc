'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calculator, Users, Briefcase, FileText, Activity, Settings, LogOut, Sun, Menu, X, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { label: 'Calculator', href: '/calculator', icon: Calculator },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Projects', href: '/projects', icon: Briefcase },
  { label: 'Proposals', href: '/proposals', icon: FileText },
  { label: 'Monitoring', href: '/monitoring', icon: Activity },
  { label: 'Solar Data', href: '/solar-assessment', icon: BarChart2 },
  { label: 'Settings', href: '/settings', icon: Settings },
]

// UI 33 — responsive sidebar. On md+ screens it's a static rail; on small
// screens it collapses behind a hamburger button and slides in as an
// off-canvas drawer with a backdrop, closing automatically on navigation.
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Close the off-canvas drawer on navigation. Adjusting state during render
  // (the React-recommended pattern for "reset state when a prop changes")
  // instead of in a useEffect avoids the cascading-render lint error.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Brand = (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b" style={{ borderColor: 'var(--sc-border)' }}>
      <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--sc-accent)' }}>
        <Sun size={14} color="var(--sc-bg)" />
      </div>
      <span className="text-base font-medium tracking-tight" style={{ fontFamily: 'Fraunces, serif', color: 'var(--sc-text)' }}>
        SolarCalc
      </span>
    </div>
  )

  const Nav = (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {nav.map(({ label, href, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors"
            style={{
              background: active ? 'var(--sc-accent-bg)' : 'transparent',
              color: active ? 'var(--sc-accent)' : 'var(--sc-muted)',
            }}
          >
            <Icon size={15} />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const SignOut = (
    <div className="px-3 pb-4 border-t pt-4" style={{ borderColor: 'var(--sc-border)' }}>
      <button
        onClick={signOut}
        className="flex items-center gap-2.5 px-3 py-2 rounded text-sm w-full transition-colors hover:opacity-80"
        style={{ color: 'var(--sc-muted)' }}
      >
        <LogOut size={15} />
        Sign out
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile top bar with hamburger trigger */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--sc-surface)', borderColor: 'var(--sc-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--sc-accent)' }}>
            <Sun size={12} color="var(--sc-bg)" />
          </div>
          <span className="text-sm font-medium tracking-tight" style={{ fontFamily: 'Fraunces, serif', color: 'var(--sc-text)' }}>
            SolarCalc
          </span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open navigation menu"
          className="p-2 rounded transition-colors"
          style={{ color: 'var(--sc-text)', background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
          <Menu size={18} />
        </button>
      </div>

      {/* Desktop static sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r" style={{
        background: 'var(--sc-surface)',
        borderColor: 'var(--sc-border)',
      }}>
        {Brand}
        {Nav}
        {SignOut}
      </aside>

      {/* Mobile off-canvas drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col border-r" style={{
            background: 'var(--sc-surface)',
            borderColor: 'var(--sc-border)',
          }}>
            <div className="flex items-center justify-between pr-3" style={{ borderColor: 'var(--sc-border)' }}>
              <div className="flex-1">{Brand}</div>
              <button onClick={() => setOpen(false)} aria-label="Close navigation menu" style={{ color: 'var(--sc-muted)' }}>
                <X size={18} />
              </button>
            </div>
            {Nav}
            {SignOut}
          </aside>
        </div>
      )}
    </>
  )
}
