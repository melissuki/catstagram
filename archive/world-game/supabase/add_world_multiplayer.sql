-- Player positions for multiplayer world
-- Safe to re-run in Supabase SQL Editor.

create table if not exists public.player_positions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  world_x double precision not null,
  world_y double precision not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One presence row per user (required for upsert ON CONFLICT)
create unique index if not exists player_positions_user_id_key
  on public.player_positions (user_id);

create index if not exists idx_player_positions_updated_at
  on public.player_positions (updated_at);

alter table public.player_positions enable row level security;

drop policy if exists "users can read all player positions" on public.player_positions;
create policy "users can read all player positions"
  on public.player_positions for select
  using (true);

drop policy if exists "users can insert own position" on public.player_positions;
create policy "users can insert own position"
  on public.player_positions for insert
  with check (user_id = auth.uid());

drop policy if exists "users can update own position" on public.player_positions;
create policy "users can update own position"
  on public.player_positions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users can delete own position" on public.player_positions;
create policy "users can delete own position"
  on public.player_positions for delete
  using (user_id = auth.uid());

-- Realtime (ignore if already added)
do $$
begin
  begin
    alter publication supabase_realtime add table public.player_positions;
  exception when duplicate_object then null;
  end;
end $$;

-- Upsert RPC used by the client
create or replace function public.upsert_player_position(
  p_player_name text,
  p_world_x double precision,
  p_world_y double precision
)
returns public.player_positions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.player_positions;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.player_positions (user_id, player_name, world_x, world_y)
  values (v_uid, p_player_name, p_world_x, p_world_y)
  on conflict (user_id) do update
  set player_name = excluded.player_name,
      world_x = excluded.world_x,
      world_y = excluded.world_y,
      updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.cleanup_inactive_players(timeout_seconds int default 30)
returns table(deleted_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.player_positions
  where updated_at < now() - make_interval(secs => timeout_seconds);

  get diagnostics v_count = row_count;
  return query select v_count as deleted_count;
end;
$$;

-- PostgREST must be allowed to call these RPCs
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.player_positions to authenticated;
grant execute on function public.upsert_player_position(text, double precision, double precision) to authenticated;
grant execute on function public.cleanup_inactive_players(int) to authenticated;

-- Reload API schema cache so the new RPC appears immediately
notify pgrst, 'reload schema';
