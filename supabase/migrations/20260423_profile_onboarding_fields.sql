-- Profile fields captured during onboarding. Nullable so existing rows
-- are unaffected; the client fills them in step by step and stamps
-- onboarding_completed_at when the final step lands.

alter table public.profiles
  add column if not exists pace text
    check (pace in ('easy','conversational','moderate','fast','all') or pace is null),
  add column if not exists run_types text[] default '{}'::text[],
  add column if not exists location_label text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists search_radius_mi numeric(4,1) default 5.0,
  add column if not exists notify_new_runs boolean default true,
  add column if not exists notify_flock_updates boolean default true,
  add column if not exists notify_reminders boolean default true,
  add column if not exists notify_weekly_digest boolean default false,
  add column if not exists onboarding_completed_at timestamptz;

-- Helpful index for Discover's "runs near me" query.
create index if not exists profiles_location_idx
  on public.profiles (location_lat, location_lng);
