import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import NewProjectForm from '@/components/calculator/NewProjectForm'
import { Market } from '@/types'

export default async function NewProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: client }, { data: profile }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('users').select('*').eq('id', user!.id).single(),
  ])

  if (!client) notFound()

  const market = (profile?.market as Market) ?? 'NL'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>New project for {client.name}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--sc-muted)' }}>Design a system, then save to create the project</p>
      <NewProjectForm client={client} market={market} />
    </div>
  )
}
