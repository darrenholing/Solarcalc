import { createClient } from '@/lib/supabase/server'
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard'

export default async function MonitoringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: installations } = await supabase
    .from('installations')
    .select('*, project:projects(*, client:clients(*))')
    .order('installed_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>Monitoring</h1>
        <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>{installations?.length ?? 0} active systems</p>
      </div>
      <MonitoringDashboard installations={installations ?? []} />
    </div>
  )
}
