-- SolarCalc — incremental migrations on top of schema.sql
-- Run in Supabase SQL editor (or via the CLI) after the base schema is applied.

-- Bug 6 — prevent duplicate proposals per project (fixes upsert race condition)
alter table proposals
  add constraint proposals_project_id_key unique (project_id);

-- Bug 7 — persist computed monthly output so the PDF generator never has to fall
-- back to recalculating irradiance at render time
alter table projects
  add column if not exists monthly_output numeric[];

-- Feature 18 — store roof assessment results against the project record
alter table projects
  add column if not exists max_kwp numeric;

-- South Africa market support — installer's province drives irradiance factors
-- (Bug 9) and is shown alongside NERSA / municipal wheeling context in Settings
alter table users
  add column if not exists province text
  check (province is null or province in ('Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape'));

-- South Africa market support — load-shedding inputs feed the battery sizing
-- recommendation in the system calculator
alter table clients
  add column if not exists avg_loadshedding_hours numeric default 0;

-- Feature 14 — monthly reset of the free-tier proposal counter.
-- Requires pg_cron (enabled by default on Supabase). Resets on the 1st of every
-- month at 00:05 UTC. Uses the service role via SECURITY DEFINER so RLS doesn't
-- block the bulk update — see Integration 28.
create extension if not exists pg_cron;

create or replace function reset_monthly_proposal_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set proposals_this_month = 0;
end;
$$;

select cron.schedule(
  'reset-proposal-counts-monthly',
  '5 0 1 * *',
  $$ select reset_monthly_proposal_counts(); $$
) where not exists (
  select 1 from cron.job where jobname = 'reset-proposal-counts-monthly'
);

-- UI 37 — public "logos" bucket for installer company logos. Unlike the
-- private "proposals" bucket (Bug 5, signed URLs), logos must be fetchable
-- without auth so they can be embedded client-side into generated PDFs and
-- shown on the public /sign/[token] page.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy if not exists "Logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy if not exists "Installers can manage their own logo"
  on storage.objects for all
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- UI 37 — column to store the public URL of the uploaded logo
alter table users
  add column if not exists logo text;
