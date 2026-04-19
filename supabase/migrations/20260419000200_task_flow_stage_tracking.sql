alter table public.task_memory
  add column if not exists task_type text,
  add column if not exists task_goal text,
  add column if not exists current_stage_index integer default 0,
  add column if not exists current_stage_title text,
  add column if not exists current_stage_detail text,
  add column if not exists next_stage_title text,
  add column if not exists next_stage_detail text,
  add column if not exists stage_plan jsonb not null default '[]'::jsonb,
  add column if not exists status text default 'active';

do $$ begin
  alter table public.task_memory
    add constraint task_memory_status_check
    check (status in ('active', 'paused', 'done'));
exception
  when duplicate_object then null;
end $$;
