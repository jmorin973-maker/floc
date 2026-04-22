-- Track when a participant was promoted off the waitlist so the
-- notify-only Edge Function can find "who was just promoted" and push.

alter table public.run_participants
  add column if not exists promoted_at timestamptz;

create or replace function public.promote_waitlist_if_spot_open(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_spots int;
  v_confirmed_count int;
  v_next_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('run:' || p_run_id::text));

  select r.spots into v_spots from public.runs r where r.id = p_run_id;
  if v_spots is null then
    return;
  end if;

  select count(*) into v_confirmed_count
  from public.run_participants rp
  where rp.run_id = p_run_id and rp.status = 'confirmed';

  if v_confirmed_count >= v_spots then
    return;
  end if;

  select rp.id into v_next_id
  from public.run_participants rp
  where rp.run_id = p_run_id and rp.status = 'waitlist'
  order by rp.waitlist_position asc nulls last, rp.joined_at asc
  limit 1;

  if v_next_id is null then
    return;
  end if;

  update public.run_participants
  set status = 'confirmed',
      waitlist_position = null,
      promoted_at = now()
  where id = v_next_id;

  with ranked as (
    select rp.id,
           row_number() over (order by rp.waitlist_position asc nulls last,
                                       rp.joined_at asc) as rn
    from public.run_participants rp
    where rp.run_id = p_run_id and rp.status = 'waitlist'
  )
  update public.run_participants rp
  set waitlist_position = ranked.rn
  from ranked
  where rp.id = ranked.id
    and rp.waitlist_position is distinct from ranked.rn;
end;
$func$;
