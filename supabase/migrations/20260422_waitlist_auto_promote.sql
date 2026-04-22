-- Auto-promote the first person on the waitlist whenever a confirmed
-- participant leaves a run (DELETE of confirmed row, or UPDATE away from
-- 'confirmed'). Runs inside the same transaction as the leave, so it is
-- atomic and race-free (advisory lock mirrors join_run).

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
    return; -- run was deleted
  end if;

  select count(*) into v_confirmed_count
  from public.run_participants rp
  where rp.run_id = p_run_id and rp.status = 'confirmed';

  if v_confirmed_count >= v_spots then
    return;
  end if;

  -- Promote the earliest waitlist entry.
  select rp.id into v_next_id
  from public.run_participants rp
  where rp.run_id = p_run_id and rp.status = 'waitlist'
  order by rp.waitlist_position asc nulls last, rp.created_at asc
  limit 1;

  if v_next_id is null then
    return;
  end if;

  update public.run_participants
  set status = 'confirmed', waitlist_position = null
  where id = v_next_id;

  -- Re-number the remaining waitlist so positions stay contiguous from 1.
  with ranked as (
    select rp.id,
           row_number() over (order by rp.waitlist_position asc nulls last,
                                       rp.created_at asc) as rn
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

create or replace function public.tg_run_participants_promote()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'DELETE' then
    if old.status = 'confirmed' then
      perform public.promote_waitlist_if_spot_open(old.run_id);
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    -- A confirmed row was demoted/changed away from confirmed.
    if old.status = 'confirmed' and new.status is distinct from 'confirmed' then
      perform public.promote_waitlist_if_spot_open(old.run_id);
    end if;
    return new;
  end if;
  return null;
end;
$func$;

drop trigger if exists run_participants_promote_waitlist on public.run_participants;
create trigger run_participants_promote_waitlist
after delete or update on public.run_participants
for each row execute function public.tg_run_participants_promote();

-- One-shot backfill: if any run already has an open spot and a waitlist,
-- promote now so existing data is reconciled.
do $func$
declare
  run_row record;
begin
  for run_row in
    select distinct rp.run_id
    from public.run_participants rp
    where rp.status = 'waitlist'
  loop
    perform public.promote_waitlist_if_spot_open(run_row.run_id);
  end loop;
end;
$func$;
