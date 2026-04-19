insert into public.user_profiles (
  user_id,
  google_email,
  google_name,
  name,
  email,
  timezone,
  age_group,
  calendar_connected,
  support_needs,
  preferences,
  conditions,
  notes,
  raw_intake_text,
  onboarding_summary,
  onboarding_completed_at
)
values (
  'demo-user-001',
  'maria.garcia@example.com',
  'Maria Garcia',
  'Maria Garcia',
  'maria.garcia@example.com',
  'America/Los_Angeles',
  'older adult',
  false,
  array[
    'Needs short, plain-language directions',
    'Benefits from reminders about the last step',
    'Should never be rushed into form submission'
  ],
  array[
    'One step at a time',
    'Simple wording',
    'Confirm before sharing personal information'
  ],
  array[
    'Mild memory and task-sequencing difficulty',
    'Needs help tracking healthcare portals and appointment steps'
  ],
  'Prefers calm, direct wording and should be warned before submitting forms or payment details.',
  'Demo intake text for the hackathon prototype.',
  'Demo user seeded from the sample intake flow.',
  now()
)
on conflict (user_id) do update set
  google_email = excluded.google_email,
  google_name = excluded.google_name,
  name = excluded.name,
  email = excluded.email,
  timezone = excluded.timezone,
  age_group = excluded.age_group,
  calendar_connected = excluded.calendar_connected,
  support_needs = excluded.support_needs,
  preferences = excluded.preferences,
  conditions = excluded.conditions,
  notes = excluded.notes,
  raw_intake_text = excluded.raw_intake_text,
  onboarding_summary = excluded.onboarding_summary,
  onboarding_completed_at = excluded.onboarding_completed_at,
  updated_at = now();

insert into public.user_context_entries (
  user_id,
  category,
  title,
  detail,
  tags,
  priority
)
values
  (
    'demo-user-001',
    'condition',
    'Memory support',
    'Needs reminders of the current task and the last step when navigating healthcare portals.',
    array['memory', 'healthcare', 'support'],
    1
  ),
  (
    'demo-user-001',
    'condition',
    'Task sequencing',
    'Benefits from one clear action at a time and should not be rushed through multi-step forms.',
    array['sequencing', 'forms', 'safety'],
    1
  ),
  (
    'demo-user-001',
    'preference',
    'Calm language',
    'Responds best to short sentences, simple wording, and a steady tone.',
    array['tone', 'clarity'],
    2
  ),
  (
    'demo-user-001',
    'support',
    'Trust check',
    'If a page looks risky, encourage pausing and checking with a trusted family member.',
    array['trust', 'risk', 'pause'],
    2
  )
on conflict do nothing;

insert into public.task_memory (
  user_id,
  current_task,
  last_step,
  current_url,
  page_title,
  updated_at
)
values (
  'demo-user-001',
  'Reviewing the upcoming cardiology appointment',
  'Opened the patient portal and checked the visit details.',
  'https://myhealth.ucsd.edu',
  'MyChart - Appointments',
  now()
)
on conflict (user_id) do update set
  current_task = excluded.current_task,
  last_step = excluded.last_step,
  current_url = excluded.current_url,
  page_title = excluded.page_title,
  updated_at = now();

insert into public.appointments (
  user_id,
  title,
  start_time,
  end_time,
  description,
  portal_link,
  source,
  location,
  prep_notes
)
values (
  'demo-user-001',
  'Cardiology follow-up with Dr. Martinez',
  timezone('utc', now() + interval '1 day')::timestamptz,
  timezone('utc', now() + interval '1 day 30 minutes')::timestamptz,
  'Bring your medication list, insurance card, and a note of any new symptoms.',
  'https://myhealth.ucsd.edu',
  'seed',
  'UCSD Medical Center',
  'Arrive 15 minutes early.'
);
