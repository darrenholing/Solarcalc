import { Skeleton } from '@/components/ui/skeleton'

export default function EditClientLoading() {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-7 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 rounded" />
          </div>
        ))}
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded" />
          <Skeleton className="h-10 w-24 rounded" />
        </div>
      </div>
    </div>
  )
}
