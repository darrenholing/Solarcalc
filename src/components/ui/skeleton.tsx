import { cn } from '@/lib/utils'

// Feature 22 — base skeleton block used to build per-route loading states
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md', className)}
      style={{ background: 'var(--sc-surface-2)' }}
      {...props}
    />
  )
}

export { Skeleton }
