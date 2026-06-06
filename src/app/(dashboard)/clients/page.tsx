import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, MapPin, Mail, Phone, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: clients } = await supabase
    .from('clients')
    .select('*, projects(count)')
    .eq('installer_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>Clients</h1>
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>{clients?.length ?? 0} clients</p>
        </div>
        <Link href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
          style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
          <Plus size={14} /> New client
        </Link>
      </div>

      {clients && clients.length > 0 ? (
        <div className="grid gap-3">
          {clients.map(client => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <div className="flex items-center justify-between p-4 rounded-lg transition-colors hover:border-opacity-60"
                style={{ background: 'var(--sc-surface)', border: '1px solid var(--sc-border)' }}>
                <div>
                  <p className="font-medium text-sm mb-1" style={{ color: 'var(--sc-text)' }}>{client.name}</p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--sc-muted)' }}>
                    <span className="flex items-center gap-1"><MapPin size={11} />{client.address}</span>
                    {client.email && <span className="flex items-center gap-1"><Mail size={11} />{client.email}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>
                    <Zap size={11} />{client.monthly_usage} kWh/mo
                  </div>
                  <div className="text-xs" style={{ color: 'var(--sc-muted)' }}>
                    {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-24" style={{ color: 'var(--sc-muted)' }}>
          <p className="mb-2">No clients yet</p>
          <Link href="/clients/new" className="text-xs underline" style={{ color: 'var(--sc-accent)' }}>Add your first client</Link>
        </div>
      )}
    </div>
  )
}
