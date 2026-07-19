-- Run in Supabase SQL Editor after the base schema.
-- Adds unique username support for search + @handles.

alter table public.profiles
  add column if not exists username text;

-- Backfill any existing rows without a username
update public.profiles
set username = lower(regexp_replace(coalesce(split_part(email, '@', 1), id::text), '[^a-z0-9_]', '', 'g'))
where username is null or username = '';

-- Ensure uniqueness (append short id suffix on collisions if needed)
do $$
declare
  r record;
  candidate text;
begin
  for r in
    select id, username
    from public.profiles
    where username in (
      select username from public.profiles group by username having count(*) > 1
    )
  loop
    candidate := left(r.username, 12) || '_' || substr(replace(r.id::text, '-', ''), 1, 6);
    update public.profiles set username = candidate where id = r.id;
  end loop;
end $$;

alter table public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username);

alter table public.profiles
  drop constraint if exists profiles_username_format_chk;

alter table public.profiles
  add constraint profiles_username_format_chk
  check (username ~ '^[a-z0-9_]{3,24}$');

-- Update signup trigger to persist username from auth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  uname := regexp_replace(uname, '[^a-z0-9_]', '', 'g');
  if length(uname) < 3 then
    uname := 'cat_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  uname := left(uname, 24);

  -- Avoid unique collisions
  while exists (select 1 from public.profiles p where p.username = uname) loop
    uname := left(uname, 16) || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, email, username, name, breed, age, bio, avatar_url)
  values (
    new.id,
    new.email,
    uname,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'breed', 'Mixed'),
    coalesce((new.raw_user_meta_data ->> 'age')::integer, 1),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;
