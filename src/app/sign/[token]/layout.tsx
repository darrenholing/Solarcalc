// UI 35 — the sign page lives outside the (dashboard)/(auth) route groups, so it
// needs its own layout to consistently inherit the app's dark theme background
// (root :root vars + color-scheme: dark already prevent the white flash; this
// wrapper guarantees the full viewport is painted in the theme background
// immediately, even before any inner content renders).
export default function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--sc-bg)', colorScheme: 'dark' }}>
      {children}
    </div>
  )
}
