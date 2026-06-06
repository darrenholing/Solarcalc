import { Skeleton } from '@/components/ui/skeleton'

export default function NewProjectLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 rounded" />
            </div>
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  )
}
