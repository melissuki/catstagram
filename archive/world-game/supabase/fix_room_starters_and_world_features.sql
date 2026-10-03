-- Fix room save (grant starter furniture even if room already exists)
-- Expand multiplayer presence with pet skin + world chat
-- Safe to re-run.

-- 1) ensure_player_room: always grant starters, then return/create room
create or replace function public.ensure_player_room()
returns public.player_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  room public.player_rooms;
  next_slot integer;
  starter_keys constant text[] := array[
    'furniture_cat_tree_peach',
    'furniture_plant_big',
    'furniture_bed_blue',
    'furniture_bowl_white_food',
    'furniture_fountain'
  ];
  item record;
  starter_layout jsonb;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  -- Always ensure starter inventory (fixes save for rooms created before starters existed)
  for item in
    select id from public.shop_items where key = any(starter_keys)
  loop
    insert into public.inventory_items (user_id, item_id)
    values (me, item.id)
    on conflict (user_id, item_id) do nothing;
  end loop;

  select * into room from public.player_rooms where user_id = me;
  if found then
    return room;
  end if;

  select coalesce(max(room_slot), -1) + 1 into next_slot from public.player_rooms;

  starter_layout := jsonb_build_array(
    jsonb_build_object('itemKey', 'furniture_cat_tree_peach', 'x', 150, 'y', 265),
    jsonb_build_object('itemKey', 'furniture_plant_big', 'x', 110, 'y', 220),
    jsonb_build_object('itemKey', 'furniture_bed_blue', 'x', 330, 'y', 270),
    jsonb_build_object('itemKey', 'furniture_bowl_white_food', 'x', 260, 'y', 315),
    jsonb_build_object('itemKey', 'furniture_fountain', 'x', 200, 'y', 320)
  );

  insert into public.player_rooms (user_id, room_slot, room_layout)
  values (me, next_slot, starter_layout)
  returning * into room;

  return room;
end;
$$;

-- 2) Presence: store which pet skin to render for multiplayer
alter table public.player_positions
  add column if not exists pet_key text not null default 'mochi';

alter table public.player_positions
  add column if not exists pet_tint text not null default 'none';

create or replace function public.upsert_player_position(
  p_player_name text,
  p_world_x double precision,
  p_world_y double precision,
  p_pet_key text default 'mochi',
  p_pet_tint text default 'none'
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

  insert into public.player_positions (
    user_id, player_name, world_x, world_y, pet_key, pet_tint
  )
  values (
    v_uid,
    p_player_name,
    p_world_x,
    p_world_y,
    coalesce(nullif(p_pet_key, ''), 'mochi'),
    coalesce(nullif(p_pet_tint, ''), 'none')
  )
  on conflict (user_id) do update
  set player_name = excluded.player_name,
      world_x = excluded.world_x,
      world_y = excluded.world_y,
      pet_key = excluded.pet_key,
      pet_tint = excluded.pet_tint,
      updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.upsert_player_position(text, double precision, double precision, text, text) to authenticated;

-- Keep 3-arg overload working for older clients
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
begin
  return public.upsert_player_position(p_player_name, p_world_x, p_world_y, 'mochi', 'none');
end;
$$;

grant execute on function public.upsert_player_position(text, double precision, double precision) to authenticated;

-- 3) World proximity chat
create table if not exists public.world_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player_name text not null,
  content text not null check (char_length(content) > 0 and char_length(content) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists world_chat_created_idx
  on public.world_chat_messages (created_at desc);

alter table public.world_chat_messages enable row level security;

drop policy if exists "world chat readable by authenticated" on public.world_chat_messages;
create policy "world chat readable by authenticated"
  on public.world_chat_messages for select
  to authenticated
  using (true);

drop policy if exists "world chat insert own" on public.world_chat_messages;
create policy "world chat insert own"
  on public.world_chat_messages for insert
  to authenticated
  with check (user_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.world_chat_messages;
  exception when duplicate_object then null;
  end;
end $$;

grant select, insert on public.world_chat_messages to authenticated;

notify pgrst, 'reload schema';
