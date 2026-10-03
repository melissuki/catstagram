-- =====================================================================
-- Catstagram — Basit karakter sistemi: coin ekonomisi + karakter marketi
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
--
-- Idempotent'tir (birden çok kez çalıştırmak güvenlidir) ve tek başına
-- yeterlidir: schema.sql + security_fixes.sql üzerine doğrudan çalışır.
-- add_economy.sql / add_avatar_config.sql / add_shop_and_rooms.sql daha önce
-- çalıştırıldıysa da sorun olmaz; aynı nesneleri günceller.
--
-- Bu dosya:
--   1) Coin cüzdanı + post serisi + günlük giriş serisi kolonları
--   2) Post ödülü (günün ilk postu) — sunucu tarafında trigger ile
--   3) Günlük giriş ödülü — claim_daily_login() RPC
--   4) Market kataloğu (karakter eşyaları) + envanter
--   5) purchase_item() — coin kontrolü + düşme + envanter tek transaction
--   6) equip_character() — yalnızca sahip olunan / ücretsiz eşyalar giyilir
--   7) Eski harita / oda özelliklerine istemci erişimini kapatır
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) profiles: ekonomi + karakter kolonları
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists coins integer not null default 0;
alter table public.profiles add column if not exists post_streak_count integer not null default 0;
alter table public.profiles add column if not exists post_streak_last_date date;
alter table public.profiles add column if not exists login_streak_count integer not null default 0;
alter table public.profiles add column if not exists login_streak_last_date date;
alter table public.profiles add column if not exists avatar_config jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_coins_chk;
alter table public.profiles add constraint profiles_coins_chk check (coins >= 0);

alter table public.profiles drop constraint if exists profiles_post_streak_count_chk;
alter table public.profiles add constraint profiles_post_streak_count_chk check (post_streak_count >= 0);

alter table public.profiles drop constraint if exists profiles_login_streak_count_chk;
alter table public.profiles add constraint profiles_login_streak_count_chk check (login_streak_count >= 0);

alter table public.profiles drop constraint if exists profiles_avatar_config_size_chk;
alter table public.profiles add constraint profiles_avatar_config_size_chk
  check (pg_column_size(avatar_config) < 2000);

alter table public.profiles drop constraint if exists profiles_avatar_config_obj_chk;
alter table public.profiles add constraint profiles_avatar_config_obj_chk
  check (jsonb_typeof(avatar_config) = 'object');

-- Güvenlik: coins / seri / avatar_config kolonlarına istemci DOĞRUDAN
-- yazamaz. Yalnızca aşağıdaki SECURITY DEFINER fonksiyonlar yazar.
-- (add_avatar_config.sql avatar_config için doğrudan UPDATE izni vermişti;
-- artık giyme işlemi sahiplik kontrolü yapan equip_character() üzerinden.)
revoke update on public.profiles from anon, authenticated;
grant update (name, breed, age, bio, avatar_url, username)
  on public.profiles to authenticated;

-- Profil satırını handle_new_user() trigger'ı oluşturur; INSERT ile coin
-- veya skor kolonları set edilemesin.
revoke insert on public.profiles from anon, authenticated;
grant insert (id, username, name, breed, age, bio, avatar_url)
  on public.profiles to authenticated;


-- ---------------------------------------------------------------------
-- 2) Post ödülü — günün ilk postu coin + seri kazandırır
-- ---------------------------------------------------------------------
create table if not exists public.daily_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_date date not null,
  streak_day integer not null check (streak_day > 0),
  coins_awarded integer not null check (coins_awarded >= 0),
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, reward_date)
);

create index if not exists daily_rewards_user_date_idx
  on public.daily_rewards (user_id, reward_date desc);

alter table public.daily_rewards enable row level security;

drop policy if exists "Users can view own reward history" on public.daily_rewards;
create policy "Users can view own reward history"
  on public.daily_rewards for select
  using (auth.uid() = user_id);

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
  total_coins integer;
begin
  -- Önce profili kilitle: aynı anda atılan iki post çift ödül alamaz
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

  -- 10 taban + seri bonusu (en fazla 30 gün * 3) + kilometre taşları
  total_coins := 10 + least(new_streak, 30) * 3 + case new_streak
    when 3 then 20
    when 7 then 50
    when 14 then 100
    when 30 then 300
    when 60 then 600
    when 100 then 1200
    else 0
  end;

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

drop trigger if exists trg_award_post_reward on public.posts;
create trigger trg_award_post_reward
  after insert on public.posts
  for each row execute function public.award_post_reward();


-- ---------------------------------------------------------------------
-- 3) Günlük giriş ödülü
-- ---------------------------------------------------------------------
create table if not exists public.daily_login_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_date date not null,
  streak_day integer not null check (streak_day > 0),
  coins_awarded integer not null check (coins_awarded >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, reward_date)
);

alter table public.daily_login_rewards enable row level security;

drop policy if exists "Users can view own login rewards" on public.daily_login_rewards;
create policy "Users can view own login rewards"
  on public.daily_login_rewards for select
  using (auth.uid() = user_id);

-- Günde bir kez ödül verir. Zaten alındıysa awarded=false döner.
-- Ödül: 10 taban + seri bonusu (en fazla 7 gün * 2) + her 7. günde +30
create or replace function public.claim_daily_login()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  prof public.profiles;
  today date := current_date;
  new_streak integer;
  amount integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into prof from public.profiles where id = me for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1 from public.daily_login_rewards
    where user_id = me and reward_date = today
  ) then
    return jsonb_build_object(
      'awarded', false,
      'coins_awarded', 0,
      'streak_day', prof.login_streak_count,
      'coins', prof.coins
    );
  end if;

  if prof.login_streak_last_date = today - 1 then
    new_streak := prof.login_streak_count + 1;
  else
    new_streak := 1;
  end if;

  amount := 10 + least(new_streak, 7) * 2
    + case when new_streak % 7 = 0 then 30 else 0 end;

  update public.profiles
    set coins = coins + amount,
        login_streak_count = new_streak,
        login_streak_last_date = today
    where id = me
    returning * into prof;

  insert into public.daily_login_rewards (user_id, reward_date, streak_day, coins_awarded)
  values (me, today, new_streak, amount);

  return jsonb_build_object(
    'awarded', true,
    'coins_awarded', amount,
    'streak_day', new_streak,
    'coins', prof.coins
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 4) Market kataloğu + envanter
-- ---------------------------------------------------------------------
create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null,
  price integer not null check (price >= 0),
  sprite_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Kategoriler artık karakter slotları (eski 'furniture' satırları pasif kalır)
alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items add constraint shop_items_category_check
  check (category in ('furniture', 'avatar', 'fur', 'eyes', 'hat', 'glasses', 'neck', 'background'));

alter table public.shop_items enable row level security;

drop policy if exists "Shop catalog is viewable by everyone" on public.shop_items;
create policy "Shop catalog is viewable by everyone"
  on public.shop_items for select
  using (true);

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

-- Eski oda mobilyaları artık satılmıyor
update public.shop_items set is_active = false where category = 'furniture';

-- Karakter eşyaları. key = sprite_key = istemcideki çizim anahtarı
-- (src/character/catalog.ts ile senkron tut). price 0 = herkese ücretsiz.
insert into public.shop_items (key, category, price, sprite_key) values
  ('fur_orange',     'fur',        0,   'fur_orange'),
  ('fur_gray',       'fur',        0,   'fur_gray'),
  ('fur_white',      'fur',        0,   'fur_white'),
  ('fur_black',      'fur',        0,   'fur_black'),
  ('fur_cream',      'fur',        60,  'fur_cream'),
  ('fur_pink',       'fur',        120, 'fur_pink'),
  ('fur_lavender',   'fur',        120, 'fur_lavender'),
  ('fur_mint',       'fur',        120, 'fur_mint'),
  ('eyes_round',     'eyes',       0,   'eyes_round'),
  ('eyes_happy',     'eyes',       0,   'eyes_happy'),
  ('eyes_sleepy',    'eyes',       40,  'eyes_sleepy'),
  ('eyes_sparkle',   'eyes',       70,  'eyes_sparkle'),
  ('eyes_heart',     'eyes',       100, 'eyes_heart'),
  ('hat_bow',        'hat',        50,  'hat_bow'),
  ('hat_flower',     'hat',        60,  'hat_flower'),
  ('hat_beanie',     'hat',        80,  'hat_beanie'),
  ('hat_party',      'hat',        90,  'hat_party'),
  ('hat_wizard',     'hat',        200, 'hat_wizard'),
  ('hat_crown',      'hat',        300, 'hat_crown'),
  ('glasses_round',  'glasses',    60,  'glasses_round'),
  ('glasses_sun',    'glasses',    90,  'glasses_sun'),
  ('glasses_heart',  'glasses',    130, 'glasses_heart'),
  ('neck_collar',    'neck',       40,  'neck_collar'),
  ('neck_bowtie',    'neck',       60,  'neck_bowtie'),
  ('neck_scarf',     'neck',       80,  'neck_scarf'),
  ('bg_peach',       'background', 0,   'bg_peach'),
  ('bg_sky',         'background', 0,   'bg_sky'),
  ('bg_mint',        'background', 40,  'bg_mint'),
  ('bg_sunset',      'background', 120, 'bg_sunset'),
  ('bg_night',       'background', 150, 'bg_night')
on conflict (key) do update set
  category = excluded.category,
  price = excluded.price,
  sprite_key = excluded.sprite_key,
  is_active = true;


-- ---------------------------------------------------------------------
-- 5) Satın alma
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
-- 6) Karakteri giydir — her slot sunucuda doğrulanır
--    Zorunlu slotlar: fur, eyes, background. Opsiyonel: hat, glasses, neck.
-- ---------------------------------------------------------------------
create or replace function public.equip_character(p_config jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  prof public.profiles;
  slot text;
  val text;
  item public.shop_items;
  clean jsonb := '{}'::jsonb;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'Config must be a JSON object';
  end if;

  foreach slot in array array['fur', 'eyes', 'hat', 'glasses', 'neck', 'background'] loop
    val := nullif(trim(p_config ->> slot), '');

    if val is null then
      if slot in ('fur', 'eyes', 'background') then
        raise exception 'Missing required slot: %', slot;
      end if;
      continue;
    end if;

    select * into item from public.shop_items
      where key = val and category = slot;
    if not found then
      raise exception 'Unknown item for %: %', slot, left(val, 64);
    end if;

    if not (
      (item.price = 0 and item.is_active)
      or exists (
        select 1 from public.inventory_items
        where user_id = me and item_id = item.id
      )
    ) then
      raise exception 'Item not owned: %', item.key;
    end if;

    clean := clean || jsonb_build_object(slot, item.key);
  end loop;

  update public.profiles
    set avatar_config = clean
    where id = me
    returning * into prof;

  return prof;
end;
$$;


-- RPC'ler yalnızca giriş yapmış kullanıcılara açık
revoke execute on function public.claim_daily_login() from public, anon;
revoke execute on function public.purchase_item(text) from public, anon;
revoke execute on function public.equip_character(jsonb) from public, anon;
grant execute on function public.claim_daily_login() to authenticated;
grant execute on function public.purchase_item(text) to authenticated;
grant execute on function public.equip_character(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 7) Eski harita / oda özellikleri uygulamadan kaldırıldı.
--    Daha önce o migration'lar çalıştırıldıysa, istemcinin bu tablolara
--    yazmasını ve RPC'leri çağırmasını kapat (veri silinmez).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  f text;
begin
  foreach t in array array['player_positions', 'world_homes', 'world_chat_messages', 'player_rooms'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;

  foreach f in array array[
    'public.upsert_player_position(text,double precision,double precision)',
    'public.upsert_player_position(text,double precision,double precision,text,text)',
    'public.cleanup_inactive_players(integer)',
    'public.claim_world_home(text)',
    'public.ensure_player_room()',
    'public.save_room_layout(jsonb)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- Eski tabloları tamamen silmek istersen (GERİ ALINAMAZ) şunları çalıştır:
--   drop table if exists public.player_positions cascade;
--   drop table if exists public.world_homes cascade;
--   drop table if exists public.world_chat_messages cascade;
--   drop table if exists public.player_rooms cascade;

notify pgrst, 'reload schema';
