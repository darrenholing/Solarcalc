'use client'

import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Project, PipelineStage, Client } from '@/types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { Euro, Zap, Calendar, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: '#60a5fa' },
  { id: 'qualified', label: 'Qualified', color: '#a78bfa' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'var(--sc-accent)' },
  { id: 'site_survey', label: 'Site Survey', color: '#f59e0b' },
  { id: 'closed_won', label: 'Closed Won', color: '#22c55e' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#ff5c5c' },
]

type ProjectWithClient = Project & { client: Client }

interface Props {
  projects: ProjectWithClient[]
  market: 'NL' | 'ZA'
}

export default function Pipeline({ projects: initial, market }: Props) {
  const [projects, setProjects] = useState(initial)
  const [dragging, setDragging] = useState<ProjectWithClient | null>(null)
  const supabase = createSupabaseClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const byStage = (stage: PipelineStage) => projects.filter(p => p.stage === stage)

  // Integration 25 — Supabase Realtime: reflect stage changes made in other sessions immediately
  useEffect(() => {
    const channel = supabase
      .channel('pipeline-projects')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        (payload) => {
          const updated = payload.new as Project
          setProjects(prev => prev.map(p =>
            p.id === updated.id ? { ...p, ...updated, client: p.client } : p
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragging(null)
    if (!over) return
    const projectId = active.id as string
    const newStage = over.id as PipelineStage
    if (!STAGES.find(s => s.id === newStage)) return

    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, stage: newStage } : p))
    await supabase.from('projects').update({ stage: newStage }).eq('id', projectId)
  }

  function handleDragStart(event: DragStartEvent) {
    const p = projects.find(p => p.id === event.active.id)
    if (p) setDragging(p)
  }

  const currency = market === 'NL' ? '€' : 'R'

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageProjects = byStage(stage.id)
          const totalValue = stageProjects.reduce((s, p) => s + p.total_cost, 0)
          return (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              projects={stageProjects}
              totalValue={totalValue}
              currency={currency}
            />
          )
        })}
      </div>
      <DragOverlay>
        {dragging && <ProjectCard project={dragging} currency={currency} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}

function DroppableColumn({ stage, projects, totalValue, currency }: {
  stage: typeof STAGES[0]; projects: ProjectWithClient[]
  totalValue: number; currency: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-64 rounded-lg p-3 flex flex-col transition-colors"
      style={{
        background: 'var(--sc-surface)',
        border: isOver ? '1px solid var(--sc-accent)' : '1px solid var(--sc-border)',
        outline: isOver ? '2px solid var(--sc-accent)' : 'none',
        outlineOffset: -2,
        minHeight: 300,
        maxHeight: 'calc(100vh - 220px)',
      }}
    >
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
          <span className="text-xs font-medium" style={{ color: 'var(--sc-text)' }}>{stage.label}</span>
        </div>
        <div className="text-right">
          <span className="text-xs" style={{ color: 'var(--sc-muted)' }}>{projects.length}</span>
          {totalValue > 0 && (
            <div className="text-xs" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono' }}>
              {currency}{Math.round(totalValue / 1000)}k
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map(project => (
            <DraggableCard key={project.id} project={project} currency={currency} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

function DraggableCard({ project, currency }: { project: ProjectWithClient; currency: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProjectCard project={project} currency={currency} />
    </div>
  )
}

function ProjectCard({ project, currency, isDragging }: { project: ProjectWithClient; currency: string; isDragging?: boolean }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div
        className="rounded p-3 cursor-pointer transition-colors group"
        style={{
          background: isDragging ? 'var(--sc-surface-2)' : 'var(--sc-bg)',
          border: '1px solid var(--sc-border)',
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : undefined,
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium leading-tight" style={{ color: 'var(--sc-text)' }}>{project.client?.name}</p>
          <ChevronRight size={12} style={{ color: 'var(--sc-muted)' }} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        </div>
        <p className="text-xs mb-2 truncate" style={{ color: 'var(--sc-muted)' }}>{project.client?.address}</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>
            <Zap size={10} />{project.system_size_kwp} kWp
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>
            <Euro size={10} />{currency}{Math.round(project.total_cost / 1000)}k
          </span>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: 'var(--sc-muted)' }}>
          <Calendar size={10} />
          {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
        </div>
      </div>
    </Link>
  )
}
