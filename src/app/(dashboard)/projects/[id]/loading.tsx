import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectDetailLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-9 w-28 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  )
}
