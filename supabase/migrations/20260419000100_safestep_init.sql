create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id text primary key,
  google_email text unique,
  google_name text,
  name text not null,
  email text,
  timezone text default 'America/Los_Angeles',
  age_group text,
  calendar_connected boolean default false,
  support_needs text[] not null default '{}'::text[],
  preferences text[] not null default '{}'::text[],
  conditions text[] not null default '{}'::text[],
  notes text,
  raw_intake_text text,
  onboarding_summary text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists google_email text unique,
  add column if not exists google_name text,
  add column if not exists raw_intake_text text,
  add column if not exists onboarding_summary text,
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.user_context_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.user_profiles(user_id) on delete cascade,
  category text not null check (category in ('condition', 'preference', 'routine', 'support', 'alert')),
  title text not null,
  detail text not null,
  tags text[] not null default '{}'::text[],
  priority integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_memory (
  user_id text primary key references public.user_profiles(user_id) on delete cascade,
  current_task text,
  last_step text,
  current_url text,
  page_title text,
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.user_profiles(user_id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  description text,
  portal_link text,
  source text not null default 'manual',
  location text,
  prep_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scam_checks (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.user_profiles(user_id) on delete set null,
  url text,
  classification text not null check (classification in ('safe', 'uncertain', 'risky')),
  explanation text,
  risk_signals text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists appointments_user_start_idx
  on public.appointments (user_id, start_time);

create index if not exists user_context_entries_user_priority_idx
  on public.user_context_entries (user_id, priority desc, updated_at desc);

alter table public.user_profiles enable row level security;
alter table public.user_context_entries enable row level security;
alter table public.task_memory enable row level security;
alter table public.appointments enable row level security;
alter table public.scam_checks enable row level security;

do $$ begin
  create policy "service role manage user profiles"
    on public.user_profiles
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manage user context entries"
    on public.user_context_entries
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manage task memory"
    on public.task_memory
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manage appointments"
    on public.appointments
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manage scam checks"
    on public.scam_checks
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception
  when duplicate_object then null;
end $$;
