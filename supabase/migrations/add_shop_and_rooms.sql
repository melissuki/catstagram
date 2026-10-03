-- Catstagram World — Faz 4 hazırlığı: mağaza + kişisel oda backend'i
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir: birden çok kez çalıştırmak güvenlidir.
-- Görsel asset'ler (sprite_key değerleri) henüz kesinleşmedi; bu dosya
-- ekonomiyi/veri modelini asset'ten bağımsız olarak hazırlar. Gerçek asset'ler
-- gelince sprite_key kolonu basit UPDATE'lerle güncellenecek.

-- 1) Mağaza kataloğu
create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null check (category in ('furniture', 'avatar')),
  price integer not null check (price >= 0),
  sprite_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;

drop policy if exists "Shop catalog is viewable by everyone" on public.shop_items;
create policy "Shop catalog is viewable by everyone"
  on public.shop_items for select
  using (true);

-- Insert/update policisi yok: katalog geliştirici tarafından SQL Editor'dan
-- yönetilir (v1'de mağaza yönetim ekranı yok).

-- 2) Envanter (satın alınan eşyalar)
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.shop_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists inventory_items_user_idx
  on public.inventory_items (user_id);

alter table public.inventory_items enable row level security;

drop policy if exists "Users can view own inventory" on public.inventory_items;
create policy "Users can view own inventory"
  on public.inventory_items for select
  using (auth.uid() = user_id);

-- Insert policisi yok: satırlar yalnızca purchase_item() RPC'si üzerinden
-- (SECURITY DEFINER, RLS'i atlayan owner rolüyle) yazılır.

-- 3) Kişisel oda (Club Penguin iglosu / Animal Crossing ev modeli)
create table if not exists public.player_rooms (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  room_slot integer not null unique,
  room_layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_rooms_layout_size_chk check (pg_column_size(room_layout) < 20000)
);

alter table public.player_rooms enable row level security;

drop policy if exists "Rooms are viewable by everyone" on public.player_rooms;
create policy "Rooms are viewable by everyone"
  on public.player_rooms for select
  using (true); -- haritada başkasının odasını ziyaret edebilmek için herkese açık

-- Insert/update policisi yok: yalnızca aşağıdaki RPC'ler üzerinden yazılır.

drop trigger if exists player_rooms_set_updated_at on public.player_rooms;
create trigger player_rooms_set_updated_at
  before update on public.player_rooms
  for each row execute function public.set_updated_at();

-- 4) Oyuncu ilk kez dünyaya girdiğinde odasını oluşturur/döndürür
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
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into room from public.player_rooms where user_id = me;
  if found then
    return room;
  end if;

  select coalesce(max(room_slot), -1) + 1 into next_slot from public.player_rooms;

  insert into public.player_rooms (user_id, room_slot)
  values (me, next_slot)
  returning * into room;

  return room;
end;
$$;

grant execute on function public.ensure_player_room() to authenticated;

-- 5) Oda döşemesini kaydet — yalnızca sahip olunan eşyalar yerleştirilebilir
create or replace function public.save_room_layout(new_layout jsonb)
returns public.player_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  room public.player_rooms;
  item jsonb;
  item_key text;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(new_layout) is distinct from 'array' then
    raise exception 'Layout must be a JSON array';
  end if;

  -- Yalnızca gerçekten sahip olunan eşyalar döşenebilir (istemci taraflı
  -- sahiplik sahteciliğini önler).
  for item in select * from jsonb_array_elements(new_layout) loop
    item_key := item ->> 'itemKey';
    if item_key is null or not exists (
      select 1
      from public.inventory_items ii
      join public.shop_items si on si.id = ii.item_id
      where ii.user_id = me and si.key = item_key
    ) then
      raise exception 'Item not owned: %', coalesce(item_key, 'unknown');
    end if;
  end loop;

  update public.player_rooms
    set room_layout = new_layout
    where user_id = me
    returning * into room;

  if not found then
    raise exception 'Room not found — call ensure_player_room() first';
  end if;

  return room;
end;
$$;

grant execute on function public.save_room_layout(jsonb) to authenticated;

-- 6) Satın alma — coin kontrolü + düşme + envantere ekleme tek transaction'da
create or replace function public.purchase_item(item_key text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  item public.shop_items;
  prof public.profiles;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into item from public.shop_items
    where key = item_key and is_active
    for update;
  if not found then
    raise exception 'Item not found: %', item_key;
  end if;

  if exists (
    select 1 from public.inventory_items where user_id = me and item_id = item.id
  ) then
    raise exception 'Item already owned';
  end if;

  select * into prof from public.profiles where id = me for update;
  if prof.coins < item.price then
    raise exception 'Not enough coins';
  end if;

  update public.profiles
    set coins = coins - item.price
    where id = me
    returning * into prof;

  insert into public.inventory_items (user_id, item_id)
  values (me, item.id);

  return prof;
end;
$$;

grant execute on function public.purchase_item(text) to authenticated;

-- 7) Başlangıç kataloğu (CatMegaFree/CatRoomFree'den kırpılan gerçek asset'ler
-- — public/game/furniture/<sprite_key>.png). key: DB'de benzersiz kimlik,
-- sprite_key: Phaser'da yüklenen doku anahtarı + dosya adı (birebir aynı).
insert into public.shop_items (key, category, price, sprite_key) values
  ('furniture_cat_tree_peach', 'furniture', 150, 'cat_tree_peach'),
  ('furniture_cat_tree_olive', 'furniture', 150, 'cat_tree_olive'),
  ('furniture_cat_tree_blue_tall', 'furniture', 180, 'cat_tree_blue_tall'),
  ('furniture_bed_blue', 'furniture', 110, 'bed_blue'),
  ('furniture_bed_gray', 'furniture', 110, 'bed_gray'),
  ('furniture_bed_pink', 'furniture', 120, 'bed_pink'),
  ('furniture_bed_olive', 'furniture', 120, 'bed_olive'),
  ('furniture_bed_purple', 'furniture', 120, 'bed_purple'),
  ('furniture_bed_white', 'furniture', 100, 'bed_white'),
  ('furniture_window_cream', 'furniture', 60, 'window_cream'),
  ('furniture_window_dark', 'furniture', 60, 'window_dark'),
  ('furniture_window_graytint', 'furniture', 70, 'window_graytint'),
  ('furniture_window_brown', 'furniture', 70, 'window_brown'),
  ('furniture_frame_small', 'furniture', 30, 'frame_small'),
  ('furniture_frame_tan', 'furniture', 35, 'frame_tan'),
  ('furniture_frame_dark', 'furniture', 40, 'frame_dark'),
  ('furniture_plant_small', 'furniture', 40, 'plant_small'),
  ('furniture_plant_big', 'furniture', 70, 'plant_big'),
  ('furniture_shelf', 'furniture', 90, 'shelf'),
  ('furniture_fountain', 'furniture', 80, 'fountain'),
  ('furniture_bowl_blue_food', 'furniture', 25, 'bowl_blue_food'),
  ('furniture_bowl_lightblue_water', 'furniture', 25, 'bowl_lightblue_water'),
  ('furniture_bowl_white_food', 'furniture', 25, 'bowl_white_food'),
  ('furniture_toy_dumbbell', 'furniture', 20, 'toy_dumbbell'),
  ('furniture_ball_green', 'furniture', 15, 'ball_green'),
  ('furniture_ball_purple', 'furniture', 15, 'ball_purple'),
  ('furniture_ball_teal', 'furniture', 15, 'ball_teal'),
  ('furniture_ball_navy', 'furniture', 15, 'ball_navy')
on conflict (key) do update set
  category = excluded.category,
  price = excluded.price,
  sprite_key = excluded.sprite_key,
  is_active = true;

-- Faz 3'ün eski placeholder anahtarları artık kullanılmıyor (gerçek asset'lerle
-- değiştirildi) — yanlışlıkla satın alınmasın diye pasife çekiliyor.
update public.shop_items
  set is_active = false
  where key in (
    'furniture_cat_tree', 'furniture_scratch_post', 'furniture_cozy_bed',
    'furniture_food_bowl', 'furniture_water_bowl', 'furniture_plant',
    'furniture_rug', 'furniture_window'
  );
