import { createClient } from '@/lib/supabase/server'
import SystemCalculator from '@/components/calculator/SystemCalculator'
import { Market } from '@/types'

export default async function CalculatorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('market').eq('id', user!.id).single()
  const market: Market = (profile?.market as Market) ?? 'NL'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>System Calculator</h1>
        <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>Design a solar system based on energy usage and roof parameters</p>
      </div>
      <SystemCalculator market={market} />
    </div>
  )
}
