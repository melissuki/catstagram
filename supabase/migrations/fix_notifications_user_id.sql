-- Fix notifications: rename recipient_id → user_id (matches app inserts/queries).
-- Also drop DB triggers so client-side inserts are the single source of truth (no duplicates).

-- 1) Rename column if needed
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'recipient_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'user_id'
  ) then
    alter table public.notifications rename column recipient_id to user_id;
  end if;
end $$;

-- Ensure user_id exists for brand-new broken tables
alter table public.notifications
  add column if not exists user_id uuid references public.profiles (id) on delete cascade;

alter table public.notifications
  add column if not exists body text not null default '';

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

-- Allow message type
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'message'));

-- Self-action guard
alter table public.notifications drop constraint if exists notifications_user_actor_chk;
alter table public.notifications
  add constraint notifications_user_actor_chk check (user_id <> actor_id);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where is_read = false;

-- 2) RLS for user_id
alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Actors can insert notifications" on public.notifications;
create policy "Actors can insert notifications"
  on public.notifications for insert
  with check (auth.uid() = actor_id and user_id <> actor_id);

-- 3) Remove trigger-based inserts (app creates rows explicitly)
drop trigger if exists trg_notify_on_like on public.likes;
drop trigger if exists trg_notify_on_comment on public.comments;
drop trigger if exists trg_notify_on_follow on public.follows;
