import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Market } from '@/types'
import ClientEditForm from '@/components/client/ClientEditForm'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: client }, { data: profile }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('users').select('market').eq('id', user!.id).single(),
  ])

  if (!client) notFound()

  const market = (profile?.market as Market) ?? 'NL'

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href={`/clients/${id}`} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--sc-muted)' }}>
        <ArrowLeft size={14} /> Back to client
      </Link>
      <h1 className="text-2xl mb-6" style={{ color: 'var(--sc-text)' }}>Edit client</h1>
      <ClientEditForm client={client} market={market} />
    </div>
  )
}
