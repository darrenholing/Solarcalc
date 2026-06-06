// Feature 14 — free tier proposal generation limit (resets monthly via the
// reset_monthly_proposal_counts() function scheduled in migrations.sql)
export const FREE_TIER_MONTHLY_PROPOSAL_LIMIT = 5

export function tierProposalLimit(tier: string): number | null {
  if (tier === 'free') return FREE_TIER_MONTHLY_PROPOSAL_LIMIT
  return null // pro / platform — unlimited
}
