-- Extend notifications for DMs + preview body text.
-- Run in Supabase SQL Editor after add_game_and_notifications.sql.

alter table public.notifications
  add column if not exists body text not null default '';

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

-- Allow type = 'message'
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'message'));

-- Enrich comment notifications with preview text
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.posts where id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id, body)
    values (owner_id, new.user_id, 'comment', new.post_id, left(new.body, 160));
  end if;
  return new;
end;
$$;

-- Like copy hint (body optional)
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.posts where id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id, body)
    values (owner_id, new.user_id, 'like', new.post_id, '');
  end if;
  return new;
end;
$$;
