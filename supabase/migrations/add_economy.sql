-- Catstagram World — Faz 2: Coin ekonomisi + gelişmiş post streak'i
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir: birden çok kez çalıştırmak güvenlidir.

-- 1) profiles: coin cüzdanı + post streak alanları
alter table public.profiles
  add column if not exists coins integer not null default 0;

alter table public.profiles
  add column if not exists post_streak_count integer not null default 0;

alter table public.profiles
  add column if not exists post_streak_last_date date;

alter table public.profiles
  drop constraint if exists profiles_coins_chk;
alter table public.profiles
  add constraint profiles_coins_chk check (coins >= 0);

alter table public.profiles
  drop constraint if exists profiles_post_streak_count_chk;
alter table public.profiles
  add constraint profiles_post_streak_count_chk check (post_streak_count >= 0);

-- Güvenlik: security_fixes.sql tabloya geniş UPDATE'i zaten kaldırıp yalnızca
-- (name, breed, age, bio, avatar_url, username) kolonlarına izin verdi.
-- coins / post_streak_count / post_streak_last_date o listede YOK, yani bu
-- kolonlara authenticated rolünden doğrudan PATCH atılamaz — sadece aşağıdaki
-- SECURITY DEFINER trigger fonksiyonu (owner olarak çalışır) yazabilir.

-- 2) Günlük ödül geçmişi — aynı gün birden fazla post atılsa da tek ödül
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

-- Insert/update policisi yok: satırlar yalnızca aşağıdaki trigger üzerinden,
-- SECURITY DEFINER olarak (RLS'i atlayan owner rolüyle) yazılır.

-- 3) Post atınca otomatik coin + streak ödülü (sunucu tarafında hesaplanır)
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
  -- Aynı gün için zaten bir ödül kaydedildiyse, ek postlar coin farm'ını
  -- önlemek adına yeni ödül tetiklemez.
  if exists (
    select 1 from public.daily_rewards
    where user_id = new.user_id and reward_date = today
  ) then
    return new;
  end if;

  select * into prof from public.profiles where id = new.user_id for update;

  if prof.post_streak_last_date = today - 1 then
    new_streak := prof.post_streak_count + 1;      -- seri devam ediyor
  else
    new_streak := 1;                                -- seri kırıldı ya da ilk gün
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
  values (new.user_id, today, new_streak, total_coins, new.id);

  return new;
end;
$$;

drop trigger if exists trg_award_post_reward on public.posts;
create trigger trg_award_post_reward
  after insert on public.posts
  for each row execute function public.award_post_reward();
