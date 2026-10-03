-- =====================================================================
-- GÜVENLİK SERTLEŞTİRMESİ — Dünya, ekonomi, mağaza ve oda tabloları
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir. TÜM diğer migration'lardan SONRA çalıştırılmalı
-- (özellikle fix_room_starters_and_world_features.sql'den sonra).
--
-- Kapatılan açıklar:
--   W-01 (YÜKSEK) cleanup_inactive_players() herkese (anon dahil) açıktı:
--        timeout_seconds = 0 ile tüm oyuncular haritadan silinebiliyordu.
--   W-02 (ORTA)   player_positions / world_homes / world_chat_messages'ta
--        player_name istemciden geliyordu: başka biri gibi görünme
--        (impersonation), sınırsız uzunlukta isim.
--   W-03 (ORTA)   world_homes'a doğrudan INSERT/UPDATE izni vardı: istenen
--        slot / koordinat yazılabiliyor, başkasının arsası işgal edilebiliyordu.
--   W-04 (ORTA)   player_positions'a doğrudan yazma: koordinat ve pet_key /
--        pet_tint doğrulaması yoktu.
--   W-05 (ORTA)   Dünya sohbetinde hız sınırı yoktu (spam).
--   W-06 (DÜŞÜK)  save_room_layout: koordinat / tekrar / adet doğrulaması
--        yoktu, keyfi JSON alanları saklanabiliyordu.
--   W-07 (DÜŞÜK)  profiles INSERT izni tüm kolonları kapsıyordu (coins,
--        game_high_score dahil) — savunma derinliği için daraltıldı.
--   W-08 (DÜŞÜK)  ensure_player_room / claim_world_home eşzamanlı ilk
--        çağrılarda slot çakışmasıyla hata veriyordu (yarış durumu).
--   W-09 (DÜŞÜK)  SECURITY DEFINER RPC'ler varsayılan olarak PUBLIC/anon'a
--        da açıktı.
-- =====================================================================


-- ---------------------------------------------------------------------
-- W-07: profiles INSERT yalnızca güvenli kolonlarda
-- (Profil satırını handle_new_user() trigger'ı oluşturur; istemci hiç
-- INSERT atmıyor. Yine de coins / skor kolonları INSERT ile set edilemesin.)
-- ---------------------------------------------------------------------
revoke insert on public.profiles from anon, authenticated;
grant insert (id, username, name, breed, age, bio, avatar_url)
  on public.profiles to authenticated;

-- avatar_config her zaman bir JSON nesnesi olmalı
alter table public.profiles
  drop constraint if exists profiles_avatar_config_obj_chk;
alter table public.profiles
  add constraint profiles_avatar_config_obj_chk
  check (jsonb_typeof(avatar_config) = 'object');


-- Yardımcı: oyuncunun görünen adını SUNUCU tarafında profilden çözer
create or replace function public.world_display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select left(coalesce(nullif(trim(p.name), ''), p.username, 'Cat'), 40)
  from public.profiles p
  where p.id = p_user
$$;

revoke execute on function public.world_display_name(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Ekonomi: ödül trigger'ı — önce profil satırını kilitle, sonra kontrol et
-- (aynı anda atılan iki post'ta ikinci post'un unique hatasıyla düşmesini
-- engeller; ödül yine günde bir kez verilir).
-- ---------------------------------------------------------------------
create or replace function public.award_post_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
  today date := current_date;
  new_streak integer;
  base_coins constant integer := 10;
  streak_bonus integer;
  milestone_bonus integer;
  total_coins integer;
begin
  select * into prof from public.profiles where id = new.user_id for update;
  if not found then
    return new;
  end if;

  if exists (
    select 1 from public.daily_rewards
    where user_id = new.user_id and reward_date = today
  ) then
    return new;
  end if;

  if prof.post_streak_last_date = today - 1 then
    new_streak := prof.post_streak_count + 1;
  else
    new_streak := 1;
  end if;

  streak_bonus := least(new_streak, 30) * 3;
  milestone_bonus := case new_streak
    when 3 then 20
    when 7 then 50
    when 14 then 100
    when 30 then 300
    when 60 then 600
    when 100 then 1200
    else 0
  end;
  total_coins := base_coins + streak_bonus + milestone_bonus;

  update public.profiles
    set coins = coins + total_coins,
        post_streak_count = new_streak,
        post_streak_last_date = today
    where id = new.user_id;

  insert into public.daily_rewards (user_id, reward_date, streak_day, coins_awarded, post_id)
  values (new.user_id, today, new_streak, total_coins, new.id)
  on conflict (user_id, reward_date) do nothing;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Mağaza: satın alma — katalog satırını değil, alıcının profilini kilitle
-- ---------------------------------------------------------------------
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

  select * into prof from public.profiles where id = me for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  select * into item from public.shop_items
    where key = item_key and is_active;
  if not found then
    raise exception 'Item not found: %', left(coalesce(item_key, ''), 64);
  end if;

  if exists (
    select 1 from public.inventory_items where user_id = me and item_id = item.id
  ) then
    raise exception 'Item already owned';
  end if;

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


-- ---------------------------------------------------------------------
-- W-08: oda oluşturma — slot ataması için advisory lock
-- ---------------------------------------------------------------------
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
  starter_layout jsonb;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.inventory_items (user_id, item_id)
  select me, si.id from public.shop_items si where si.key = any(starter_keys)
  on conflict (user_id, item_id) do nothing;

  select * into room from public.player_rooms where user_id = me;
  if found then
    return room;
  end if;

  perform pg_advisory_xact_lock(hashtext('catstagram.player_rooms.slot'));

  -- Kilidi beklerken aynı kullanıcının diğer isteği odayı oluşturmuş olabilir
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


-- ---------------------------------------------------------------------
-- W-06: oda düzeni — adet, tekrar ve koordinat doğrulaması; yalnızca
-- bilinen alanlar saklanır. (Oyun tuvali 800x600.)
-- ---------------------------------------------------------------------
create or replace function public.save_room_layout(new_layout jsonb)
returns public.player_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  room public.player_rooms;
  entry jsonb;
  item_key text;
  seen text[] := array[]::text[];
  clean jsonb := '[]'::jsonb;
  clean_entry jsonb;
  max_items constant integer := 60;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(new_layout) is distinct from 'array' then
    raise exception 'Layout must be a JSON array';
  end if;

  if jsonb_array_length(new_layout) > max_items then
    raise exception 'Too many items in layout';
  end if;

  for entry in select * from jsonb_array_elements(new_layout) loop
    if jsonb_typeof(entry) is distinct from 'object' then
      raise exception 'Invalid layout entry';
    end if;

    item_key := entry ->> 'itemKey';
    if item_key is null or not exists (
      select 1
      from public.inventory_items ii
      join public.shop_items si on si.id = ii.item_id
      where ii.user_id = me and si.key = item_key
    ) then
      raise exception 'Item not owned: %', left(coalesce(item_key, 'unknown'), 64);
    end if;

    if item_key = any(seen) then
      raise exception 'Duplicate item in layout: %', item_key;
    end if;
    seen := seen || item_key;

    if jsonb_typeof(entry -> 'x') is distinct from 'number'
       or jsonb_typeof(entry -> 'y') is distinct from 'number' then
      raise exception 'Invalid coordinates for %', item_key;
    end if;

    clean_entry := jsonb_build_object(
      'itemKey', item_key,
      'x', greatest(0, least(800, round((entry ->> 'x')::numeric))),
      'y', greatest(0, least(600, round((entry ->> 'y')::numeric)))
    );
    if jsonb_typeof(entry -> 'rotation') = 'number' then
      clean_entry := clean_entry || jsonb_build_object(
        'rotation', mod(round((entry ->> 'rotation')::numeric), 360)
      );
    end if;

    clean := clean || jsonb_build_array(clean_entry);
  end loop;

  update public.player_rooms
    set room_layout = clean
    where user_id = me
    returning * into room;

  if not found then
    raise exception 'Room not found — call ensure_player_room() first';
  end if;

  return room;
end;
$$;

-- Odalar yalnızca giriş yapmış kullanıcılara görünür
drop policy if exists "Rooms are viewable by everyone" on public.player_rooms;
drop policy if exists "Rooms are viewable by signed-in users" on public.player_rooms;
create policy "Rooms are viewable by signed-in users"
  on public.player_rooms for select
  to authenticated
  using (true);


-- ---------------------------------------------------------------------
-- W-03 + W-02: kalıcı evler — doğrudan yazma kapalı, isim sunucudan
-- ---------------------------------------------------------------------
drop policy if exists "world homes upsert own" on public.world_homes;
drop policy if exists "world homes update own" on public.world_homes;
revoke insert, update, delete on public.world_homes from anon, authenticated;

create or replace function public.claim_world_home(p_player_name text)
returns public.world_homes
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  home public.world_homes;
  display_name text;
  next_slot integer;
  -- WorldScene HOUSE_* sabitleriyle senkron tut (piksel)
  base_x constant double precision := 140;
  base_y constant double precision := 160;
  gap_x constant double precision := 170;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  -- İstemcinin gönderdiği isim yok sayılır; profil adı kullanılır.
  display_name := coalesce(public.world_display_name(me), 'Cat');

  select * into home from public.world_homes where user_id = me;
  if found then
    if home.player_name is distinct from display_name then
      update public.world_homes
        set player_name = display_name, updated_at = now()
        where user_id = me
        returning * into home;
    end if;
    return home;
  end if;

  perform pg_advisory_xact_lock(hashtext('catstagram.world_homes.slot'));

  select * into home from public.world_homes where user_id = me;
  if found then
    return home;
  end if;

  select coalesce(max(slot_index), -1) + 1 into next_slot from public.world_homes;

  insert into public.world_homes (user_id, player_name, slot_index, plot_x, plot_y)
  values (me, display_name, next_slot, base_x + next_slot * gap_x, base_y)
  returning * into home;

  return home;
end;
$$;


-- ---------------------------------------------------------------------
-- W-04 + W-02 + W-01: canlı konumlar
-- ---------------------------------------------------------------------
drop policy if exists "users can insert own position" on public.player_positions;
drop policy if exists "users can update own position" on public.player_positions;
revoke insert, update on public.player_positions from anon, authenticated;

-- Konumlar yalnızca giriş yapmış kullanıcılara görünür
drop policy if exists "users can read all player positions" on public.player_positions;
create policy "users can read all player positions"
  on public.player_positions for select
  to authenticated
  using (true);

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
  v_name text;
  v_pet text;
  v_tint text;
  v_x double precision;
  v_y double precision;
  -- Dünya haritası: 48x36 karo * 16px * 3 ölçek
  max_x constant double precision := 2304;
  max_y constant double precision := 1728;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_world_x is null or p_world_y is null then
    raise exception 'Invalid position';
  end if;

  v_name := coalesce(public.world_display_name(v_uid), 'Cat');
  v_pet := case when p_pet_key in ('mochi', 'pochi') then p_pet_key else 'mochi' end;
  v_tint := case
    when p_pet_tint in ('none', 'sandy', 'silver', 'blush', 'mint', 'lavender') then p_pet_tint
    else 'none'
  end;
  -- Harita dışı / Infinity / NaN değerler sınırlar içine sıkıştırılır
  -- (Postgres'te NaN her sayıdan büyük kabul edilir, least() onu max'a çeker).
  v_x := greatest(0, least(max_x, p_world_x));
  v_y := greatest(0, least(max_y, p_world_y));

  insert into public.player_positions (user_id, player_name, world_x, world_y, pet_key, pet_tint)
  values (v_uid, v_name, v_x, v_y, v_pet, v_tint)
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

-- W-01: temizlik yalnızca sunucu (service_role / pg_cron) tarafından çağrılabilir
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
  where updated_at < now() - make_interval(secs => greatest(coalesce(timeout_seconds, 30), 30));

  get diagnostics v_count = row_count;
  return query select v_count as deleted_count;
end;
$$;

revoke execute on function public.cleanup_inactive_players(int) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- W-02 + W-05: dünya sohbeti — kimlik ve isim sunucudan, hız sınırı
-- ---------------------------------------------------------------------
create index if not exists world_chat_user_created_idx
  on public.world_chat_messages (user_id, created_at desc);

create or replace function public.world_chat_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  recent_count integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  new.user_id := me;
  new.player_name := coalesce(public.world_display_name(me), 'Cat');
  new.content := trim(new.content);
  new.created_at := now();

  -- En fazla 5 mesaj / 10 saniye
  select count(*) into recent_count
  from public.world_chat_messages
  where user_id = me and created_at > now() - interval '10 seconds';

  if recent_count >= 5 then
    raise exception 'Slow down: too many chat messages';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_world_chat_before_insert on public.world_chat_messages;
create trigger trg_world_chat_before_insert
  before insert on public.world_chat_messages
  for each row execute function public.world_chat_before_insert();


-- ---------------------------------------------------------------------
-- W-09: RPC'leri yalnızca giriş yapmış kullanıcılara aç
-- ---------------------------------------------------------------------
revoke execute on function public.purchase_item(text) from public, anon;
revoke execute on function public.save_room_layout(jsonb) from public, anon;
revoke execute on function public.ensure_player_room() from public, anon;
revoke execute on function public.claim_world_home(text) from public, anon;
revoke execute on function public.upsert_player_position(text, double precision, double precision, text, text) from public, anon;
revoke execute on function public.upsert_player_position(text, double precision, double precision) from public, anon;

grant execute on function public.purchase_item(text) to authenticated;
grant execute on function public.save_room_layout(jsonb) to authenticated;
grant execute on function public.ensure_player_room() to authenticated;
grant execute on function public.claim_world_home(text) to authenticated;
grant execute on function public.upsert_player_position(text, double precision, double precision, text, text) to authenticated;
grant execute on function public.upsert_player_position(text, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
