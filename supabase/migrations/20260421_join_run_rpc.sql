-- Atomic run-join RPC: serializes concurrent joins with a per-run advisory lock
-- so that capacity checks and waitlist_position assignment are race-free.
create or replace function public.join_run(p_run_id uuid)
returns table (status text, waitlist_position int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_spots int;
  v_creator uuid;
  v_confirmed_count int;
  v_status text;
  v_position int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('run:' || p_run_id::text));

  select r.spots, r.creator_id into v_spots, v_creator
  from public.runs r where r.id = p_run_id;

  if not found then
    raise exception 'Run not found' using errcode = 'P0002';
  end if;

  if v_creator = v_user_id then
    raise exception 'Cannot join own run' using errcode = 'P0001';
  end if;

  select count(*) into v_confirmed_count
  from public.run_participants rp
  where rp.run_id = p_run_id and rp.status = 'confirmed';

  if v_confirmed_count < v_spots then
    v_status := 'confirmed';
    v_position := null;
  else
    v_status := 'waitlist';
    select coalesce(max(rp.waitlist_position), 0) + 1 into v_position
    from public.run_participants rp
    where rp.run_id = p_run_id and rp.status = 'waitlist';
  end if;

  insert into public.run_participants (run_id, user_id, status, waitlist_position)
  values (p_run_id, v_user_id, v_status, v_position);

  return query select v_status, v_position;
end;
$$;

grant execute on function public.join_run(uuid) to authenticated;
