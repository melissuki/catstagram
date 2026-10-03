-- Persistent player homes on the world map (survive logout / leave)
-- Safe to re-run.

create table if not exists public.world_homes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  player_name text not null,
  slot_index integer not null,
  plot_x double precision not null,
  plot_y double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_homes_slot_unique unique (slot_index)
);

create index if not exists world_homes_slot_idx on public.world_homes (slot_index);

alter table public.world_homes enable row level security;

drop policy if exists "world homes readable" on public.world_homes;
create policy "world homes readable"
  on public.world_homes for select
  to authenticated
  using (true);

drop policy if exists "world homes upsert own" on public.world_homes;
create policy "world homes upsert own"
  on public.world_homes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "world homes update own" on public.world_homes;
create policy "world homes update own"
  on public.world_homes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Claim (or refresh name for) a permanent house plot in a horizontal street row
create or replace function public.claim_world_home(p_player_name text)
returns public.world_homes
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  home public.world_homes;
  next_slot integer;
  -- Keep in sync with WorldScene HOUSE_* constants (pixel coords)
  base_x constant double precision := 140;
  base_y constant double precision := 160;
  gap_x constant double precision := 170;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into home from public.world_homes where user_id = me;
  if found then
    update public.world_homes
      set player_name = coalesce(nullif(trim(p_player_name), ''), player_name),
          updated_at = now()
      where user_id = me
      returning * into home;
    return home;
  end if;

  select coalesce(max(slot_index), -1) + 1 into next_slot from public.world_homes;

  insert into public.world_homes (user_id, player_name, slot_index, plot_x, plot_y)
  values (
    me,
    coalesce(nullif(trim(p_player_name), ''), 'Cat'),
    next_slot,
    base_x + next_slot * gap_x,
    base_y
  )
  returning * into home;

  return home;
end;
$$;

grant select on public.world_homes to authenticated;
grant execute on function public.claim_world_home(text) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.world_homes;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
