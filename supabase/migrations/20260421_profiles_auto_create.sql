-- Auto-create a public.profiles row whenever a new auth.users row is inserted.
-- The client's supabase.auth.signUp({ options: { data: { full_name } } }) stores
-- full_name in raw_user_meta_data; pull it from there.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill: create profiles rows for any existing auth users that are missing one.
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
