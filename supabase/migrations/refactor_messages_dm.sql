-- Direct Messaging model: sender_id + receiver_id + content
-- Run in Supabase SQL Editor. Migrates old conversation-based rows when possible.

-- 1) Add new columns
alter table public.messages
  add column if not exists receiver_id uuid references public.profiles (id) on delete cascade;

alter table public.messages
  add column if not exists content text;

-- 2) Backfill content from legacy body
update public.messages
set content = coalesce(nullif(content, ''), body, '')
where content is null or content = '';

-- 3) Backfill receiver_id from conversation_members (legacy)
update public.messages m
set receiver_id = cm.user_id
from public.conversation_members cm
where m.receiver_id is null
  and m.conversation_id is not null
  and cm.conversation_id = m.conversation_id
  and cm.user_id <> m.sender_id;

-- Drop rows that still cannot resolve a receiver (orphans)
delete from public.messages
where receiver_id is null;

-- 4) Enforce new shape
alter table public.messages
  alter column content set default '';

alter table public.messages
  alter column content set not null;

alter table public.messages
  alter column receiver_id set not null;

alter table public.messages
  drop constraint if exists messages_sender_receiver_chk;

alter table public.messages
  add constraint messages_sender_receiver_chk check (sender_id <> receiver_id);

-- Make legacy conversation_id optional
alter table public.messages
  alter column conversation_id drop not null;

create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

create index if not exists messages_receiver_created_idx
  on public.messages (receiver_id, created_at desc);

create index if not exists messages_pair_created_idx
  on public.messages (sender_id, receiver_id, created_at);

-- 5) RLS for direct DMs
drop policy if exists "Members can read messages" on public.messages;
drop policy if exists "Members can send messages" on public.messages;
drop policy if exists "Users can read own DMs" on public.messages;
drop policy if exists "Users can send DMs" on public.messages;

create policy "Users can read own DMs"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send DMs"
  on public.messages for insert
  with check (auth.uid() = sender_id and sender_id <> receiver_id);

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
end $$;
