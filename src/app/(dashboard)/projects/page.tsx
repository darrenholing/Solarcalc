import { createClient } from '@/lib/supabase/server'
import Pipeline from '@/components/crm/Pipeline'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Market } from '@/types'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('users').select('market').eq('id', user!.id).single(),
    supabase
      .from('projects')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false }),
  ])

  const market = (profile?.market as Market) ?? 'NL'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)' }}>Projects</h1>
          <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>
            {projects?.length ?? 0} active projects
          </p>
        </div>
        <Link href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
          style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
          <Plus size={14} /> New project
        </Link>
      </div>
      {projects && projects.length > 0 ? (
        <Pipeline projects={projects as any} market={market} />
      ) : (
        <div className="text-center py-24" style={{ color: 'var(--sc-muted)' }}>
          <p className="mb-2">No projects yet</p>
          <p className="text-xs">Add a client and create a project to get started</p>
        </div>
      )}
    </div>
  )
}
