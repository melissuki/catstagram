-- Catstagram World — yeni oyunculara başlangıç mobilyası
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir. add_shop_and_rooms.sql'den SONRA çalıştırılmalı.
--
-- ensure_player_room() artık oda ilk oluşturulduğunda 5 parça mobilyayı
-- ücretsiz envantere ekliyor ve varsayılan bir düzen kuruyor, böylece yeni
-- oyuncu mağazadan hiçbir şey almadan odasını hemen düzenleyebiliyor.

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

  select * into room from public.player_rooms where user_id = me;
  if found then
    return room;
  end if;

  select coalesce(max(room_slot), -1) + 1 into next_slot from public.player_rooms;

  for item in
    select id from public.shop_items where key = any(starter_keys)
  loop
    insert into public.inventory_items (user_id, item_id)
    values (me, item.id)
    on conflict (user_id, item_id) do nothing;
  end loop;

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
