-- Run in Supabase SQL Editor if stories table is missing.
-- Instagram-like ephemeral stories (app filters to last 24 hours).

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists stories_user_id_idx on public.stories (user_id);
create index if not exists stories_created_at_idx on public.stories (created_at desc);

alter table public.stories enable row level security;

drop policy if exists "Stories are viewable by everyone" on public.stories;
create policy "Stories are viewable by everyone"
  on public.stories for select
  using (true);

drop policy if exists "Users can create own stories" on public.stories;
create policy "Users can create own stories"
  on public.stories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own stories" on public.stories;
create policy "Users can delete own stories"
  on public.stories for delete
  using (auth.uid() = user_id);
