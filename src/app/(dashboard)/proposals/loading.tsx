import { Skeleton } from '@/components/ui/skeleton'

export default function ProposalsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-lg" />
        ))}
      </div>
    </div>
  )
}
