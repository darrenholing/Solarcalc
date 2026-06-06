import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/layout/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).single()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl mb-6" style={{ color: 'var(--sc-text)' }}>Settings</h1>
      <SettingsForm profile={profile} userId={user!.id} />
    </div>
  )
}
