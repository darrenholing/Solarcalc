import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Integration 28 — server-side admin client using the service role key.
// Bypasses RLS — only ever import this in server-side code (route handlers,
// server actions, cron/edge functions). Never expose to the browser.
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured — admin client unavailable')
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
