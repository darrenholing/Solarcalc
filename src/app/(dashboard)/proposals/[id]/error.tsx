'use client'

import RouteError from '@/components/ui/route-error'

export default function ProposalDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} label="proposal" />
}
