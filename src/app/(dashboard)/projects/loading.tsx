import { Skeleton } from '@/components/ui/skeleton'

// Mirrors the Kanban pipeline layout (6 stage columns) so the loading state
// doesn't jump when the real board mounts.
export default function ProjectsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-32 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="space-y-2">
            <Skeleton className="h-5 w-20" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-24 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
