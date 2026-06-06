import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-4 mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 rounded" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded" />
      </div>
    </div>
  )
}
