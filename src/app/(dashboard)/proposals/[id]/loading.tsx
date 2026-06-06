import { Skeleton } from '@/components/ui/skeleton'

export default function ProposalDetailLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-7 w-20 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
      <Skeleton className="h-[28rem] rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  )
}
