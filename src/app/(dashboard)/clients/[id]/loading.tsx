import { Skeleton } from '@/components/ui/skeleton'

export default function ClientDetailLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-72 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  )
}
