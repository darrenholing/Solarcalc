import { Skeleton } from '@/components/ui/skeleton'

// Feature 22 — generic fallback loading state for dashboard routes that don't
// define a more specific loading.tsx of their own.
export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <Skeleton className="h-40 rounded-lg" />
    </div>
  )
}
