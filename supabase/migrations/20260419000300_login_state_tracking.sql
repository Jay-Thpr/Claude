alter table public.user_profiles
  add column if not exists login_completed_at timestamptz;

