-- Per-user Mama Streak isolation (run in Supabase SQL Editor).

alter table public.profiles
  add column if not exists food_streak integer not null default 0;

alter table public.profiles
  add column if not exists last_fed_date date;

alter table public.profiles
  drop constraint if exists profiles_food_streak_chk;

alter table public.profiles
  add constraint profiles_food_streak_chk check (food_streak >= 0);
