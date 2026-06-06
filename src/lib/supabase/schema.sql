-- SolarCalc Database Schema
-- Run this in Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users (installers)
create table if not exists users (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  company text not null,
  email text not null unique,
  logo text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'platform')),
  market text not null default 'NL' check (market in ('NL', 'ZA')),
  proposals_this_month int not null default 0,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
create policy "Users can view own record" on users for select using (auth.uid() = id);
create policy "Users can update own record" on users for update using (auth.uid() = id);
create policy "Users can insert own record" on users for insert with check (auth.uid() = id);

-- Clients
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  installer_id uuid references users(id) on delete cascade not null,
  name text not null,
  address text not null,
  email text,
  phone text,
  monthly_usage numeric not null default 0,
  tariff numeric not null default 0,
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
create policy "Installers manage own clients" on clients for all using (auth.uid() = installer_id);

-- Projects
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal_sent','site_survey','closed_won','closed_lost')),
  system_size_kwp numeric not null default 0,
  panel_count int not null default 0,
  panel_wattage int not null default 400,
  roof_orientation numeric not null default 180,
  roof_tilt numeric not null default 35,
  roof_area_m2 numeric,
  total_cost numeric not null default 0,
  annual_savings numeric not null default 0,
  annual_output_kwh numeric not null default 0,
  payback_years numeric not null default 0,
  co2_offset_kg numeric not null default 0,
  btw_amount numeric,
  notes text,
  created_at timestamptz not null default now(),
  signed_at timestamptz
);

alter table projects enable row level security;
create policy "Installers manage own projects" on projects for all
  using (exists (select 1 from clients c where c.id = projects.client_id and c.installer_id = auth.uid()));

-- Proposals
create table if not exists proposals (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  pdf_url text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signature_data text,
  sign_token uuid default uuid_generate_v4() unique,
  created_at timestamptz not null default now()
);

alter table proposals enable row level security;
create policy "Installers manage own proposals" on proposals for all
  using (exists (
    select 1 from projects p
    join clients c on c.id = p.client_id
    where p.id = proposals.project_id and c.installer_id = auth.uid()
  ));

-- Public sign access via token (no auth required)
create policy "Public sign access" on proposals for update
  using (sign_token is not null)
  with check (sign_token is not null);

-- Installations
create table if not exists installations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null unique,
  installed_at timestamptz not null default now(),
  inverter_type text not null default 'other' check (inverter_type in ('victron','solaredge','other')),
  monitoring_api_key text,
  system_id text
);

alter table installations enable row level security;
create policy "Installers manage own installations" on installations for all
  using (exists (
    select 1 from projects p
    join clients c on c.id = p.client_id
    where p.id = installations.project_id and c.installer_id = auth.uid()
  ));

-- Storage bucket for proposal PDFs and logos
insert into storage.buckets (id, name, public) values ('proposals', 'proposals', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict do nothing;

create policy "Installers upload proposals" on storage.objects for insert
  with check (bucket_id = 'proposals' and auth.role() = 'authenticated');
create policy "Installers read own proposals" on storage.objects for select
  using (bucket_id = 'proposals' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Public logos" on storage.objects for select
  using (bucket_id = 'logos');
create policy "Installers upload logos" on storage.objects for insert
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');
