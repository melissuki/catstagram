-- =====================================================================
-- GÜVENLİK SERTLEŞTİRMESİ v2
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir. character_shop_and_daily_login.sql'den SONRA çalıştır.
--
-- Kapatılan açıklar:
--   S-01 (YÜKSEK) Oyun skoru: update_game_high_score() 200000'e kadar her
--        skoru kabul ediyordu. Oyunda ulaşılabilir en yüksek skor ~430.
--        Artık skor yalnızca sunucuda başlatılmış, en az 29 sn sürmüş bir
--        oyun oturumuyla ve en fazla 450 olarak kaydedilebilir.
--        Hileli skorlar (>450) sıfırlanır.
--   S-02 (YÜKSEK) Fotoğraf deposu (cat-photos): giriş yapmış HERHANGİ bir
--        kullanıcı başkalarının fotoğraflarını silebiliyor / değiştirebiliyordu.
--        Artık herkes yalnızca kendi klasöründeki dosyaları silebilir;
--        güncelleme kapalı; dosya boyutu 10 MB ve yalnızca görsel.
--   S-03 (ORTA)   Sahte bildirim: herkes herkese, hiçbir eylem yapmadan,
--        istediği metinle "mesaj/yorum" bildirimi gönderebiliyordu. Artık
--        bildirim yalnızca gerçekten yapılmış bir beğeni / yorum / takip /
--        mesaj için oluşturulabilir; metni sunucu belirler.
--   S-04 (ORTA)   Spam: gönderi, yorum, mesaj, beğeni, takip ve hikaye için
--        kullanıcı başına hız sınırı yoktu.
--   S-05 (DÜŞÜK)  Metin uzunlukları ve gönderi / profil fotoğrafı adresleri
--        yalnızca istemcide sınırlanıyordu (API'ye doğrudan istekle aşılabilir).
--   S-06 (DÜŞÜK)  Kullanılmayan conversations / conversation_members
--        tablolarına herkes kendini ekleyebiliyordu.
--   HATA          Canlı veritabanında stories tablosu yoktu (hikayeler çalışmıyordu).
-- =====================================================================


-- ---------------------------------------------------------------------
-- S-01: Oyun oturumları
-- ---------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer
);

create index if not exists game_sessions_user_started_idx
  on public.game_sessions (user_id, started_at desc);

alter table public.game_sessions enable row level security;

drop policy if exists "Users can view own game sessions" on public.game_sessions;
create policy "Users can view own game sessions"
  on public.game_sessions for select
  using (auth.uid() = user_id);

-- Yazma politikası yok: yalnızca aşağıdaki fonksiyonlar yazar.
revoke insert, update, delete on public.game_sessions from anon, authenticated;

create or replace function public.start_treat_game()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  session_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if (
    select count(*) from public.game_sessions
    where user_id = me and started_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'Too many games, take a break';
  end if;

  insert into public.game_sessions (user_id) values (me)
  returning id into session_id;

  return session_id;
end;
$$;

-- Oyun 30 sn sürer, 700 ms'de bir ikram çıkar, her biri 10 puan:
-- ulaşılabilir en yüksek skor ~430. Oyun değişirse max_score'u güncelle.
create or replace function public.finish_treat_game(p_session uuid, p_score integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  sess public.game_sessions;
  best integer;
  max_score constant integer := 450;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into sess from public.game_sessions
    where id = p_session and user_id = me
    for update;
  if not found then
    raise exception 'Game session not found';
  end if;
  if sess.finished_at is not null then
    raise exception 'Game already submitted';
  end if;
  if now() - sess.started_at < interval '29 seconds' then
    raise exception 'Game too short';
  end if;
  if now() - sess.started_at > interval '15 minutes' then
    raise exception 'Game session expired';
  end if;
  if p_score is null or p_score < 0 or p_score > max_score or p_score % 10 <> 0 then
    raise exception 'Invalid score';
  end if;

  update public.game_sessions
    set finished_at = now(), score = p_score
    where id = sess.id;

  update public.profiles
    set game_high_score = greatest(game_high_score, p_score)
    where id = me
    returning game_high_score into best;

  return best;
end;
$$;

revoke execute on function public.start_treat_game() from public, anon;
revoke execute on function public.finish_treat_game(uuid, integer) from public, anon;
grant execute on function public.start_treat_game() to authenticated;
grant execute on function public.finish_treat_game(uuid, integer) to authenticated;

-- Eski, oturumsuz skor fonksiyonunu kapat
do $$
begin
  if to_regprocedure('public.update_game_high_score(integer)') is not null then
    revoke execute on function public.update_game_high_score(integer) from public, anon, authenticated;
  end if;
end $$;

-- Hileli skorları sıfırla ve tavanı veritabanı seviyesinde de uygula
update public.profiles set game_high_score = 0 where game_high_score > 450;

alter table public.profiles drop constraint if exists profiles_game_high_score_max_chk;
alter table public.profiles add constraint profiles_game_high_score_max_chk
  check (game_high_score <= 450);


-- ---------------------------------------------------------------------
-- S-02: Fotoğraf deposu
-- Yeni yükleme yolu: public/<kullanıcı-id>/<dosya> veya stories/<kullanıcı-id>/<dosya>
-- Eski yol (public/<dosya>) geçiş süresince yüklemede kabul edilir; upsert
-- kapalı olduğu için başkasının dosyasının üzerine yazılamaz.
-- ---------------------------------------------------------------------
update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array['image/*']
  where id = 'cat-photos';

drop policy if exists "Cat photos are publicly accessible" on storage.objects;
drop policy if exists "Users can list own cat photos" on storage.objects;
-- Public bucket: dosyalar herkese açık URL ile görünür. API ile LİSTELEME
-- ise yalnızca kişinin kendi klasöründe yapılabilir.
create policy "Users can list own cat photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'cat-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Authenticated users can upload cat photos" on storage.objects;
drop policy if exists "Users can upload cat photos" on storage.objects;
create policy "Users can upload cat photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cat-photos'
    and (storage.foldername(name))[1] in ('public', 'stories')
    and (
      array_length(storage.foldername(name), 1) = 1
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- Güncelleme gerekmiyor (uygulama upsert kullanmıyor)
drop policy if exists "Users can update cat photos" on storage.objects;

drop policy if exists "Users can delete cat photos" on storage.objects;
drop policy if exists "Users can delete own cat photos" on storage.objects;
create policy "Users can delete own cat photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cat-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );


-- ---------------------------------------------------------------------
-- S-03: Bildirimler yalnızca gerçek eylemler için
-- ---------------------------------------------------------------------
create or replace function public.validate_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  preview text;
begin
  -- Sunucu (service_role) tarafından eklenen bildirimler serbest
  if me is null then
    return new;
  end if;

  if new.actor_id is distinct from me or new.user_id = new.actor_id then
    raise exception 'Invalid notification';
  end if;

  new.is_read := false;
  new.created_at := now();

  if new.type = 'like' then
    if new.post_id is null or not exists (
      select 1 from public.likes l
      join public.posts p on p.id = l.post_id
      where l.post_id = new.post_id and l.user_id = me and p.user_id = new.user_id
    ) then
      raise exception 'Invalid notification';
    end if;
    -- Beğen / vazgeç / beğen spamini engelle: günde bir bildirim
    if exists (
      select 1 from public.notifications
      where actor_id = me and user_id = new.user_id and type = 'like'
        and post_id = new.post_id and created_at > now() - interval '1 day'
    ) then
      return null;
    end if;
    new.body := '';
    new.conversation_id := null;

  elsif new.type = 'comment' then
    select c.body into preview
    from public.comments c
    join public.posts p on p.id = c.post_id
    where c.post_id = new.post_id and c.user_id = me and p.user_id = new.user_id
      and c.created_at > now() - interval '10 minutes'
    order by c.created_at desc
    limit 1;
    if not found then
      raise exception 'Invalid notification';
    end if;
    new.body := left(coalesce(preview, ''), 160);
    new.conversation_id := null;

  elsif new.type = 'follow' then
    if not exists (
      select 1 from public.follows
      where follower_id = me and following_id = new.user_id
    ) then
      raise exception 'Invalid notification';
    end if;
    if exists (
      select 1 from public.notifications
      where actor_id = me and user_id = new.user_id and type = 'follow'
        and created_at > now() - interval '1 day'
    ) then
      return null;
    end if;
    new.body := '';
    new.post_id := null;
    new.conversation_id := null;

  elsif new.type = 'message' then
    select m.content into preview
    from public.messages m
    where m.sender_id = me and m.receiver_id = new.user_id
      and m.created_at > now() - interval '10 minutes'
    order by m.created_at desc
    limit 1;
    if not found then
      raise exception 'Invalid notification';
    end if;
    -- Önizleme metni istemciden değil, gerçek mesajdan gelir
    new.body := case when coalesce(new.body, '') = '' then '' else left(preview, 160) end;
    new.post_id := null;

  else
    raise exception 'Invalid notification';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_notification on public.notifications;
create trigger trg_validate_notification
  before insert on public.notifications
  for each row execute function public.validate_notification();


-- ---------------------------------------------------------------------
-- S-04: Kullanıcı başına hız sınırı (genel trigger)
-- argümanlar: kullanıcı kolonu, en fazla adet, zaman aralığı
-- ---------------------------------------------------------------------
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  recent integer;
begin
  if me is null then
    return new;
  end if;

  execute format(
    'select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval',
    tg_table_schema, tg_table_name, tg_argv[0]
  )
  into recent
  using me, tg_argv[2];

  if recent >= tg_argv[1]::integer then
    raise exception 'Slow down: too many % in a short time', tg_table_name;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rate_limit on public.posts;
create trigger trg_rate_limit before insert on public.posts
  for each row execute function public.enforce_rate_limit('user_id', '10', '1 hour');

drop trigger if exists trg_rate_limit on public.comments;
create trigger trg_rate_limit before insert on public.comments
  for each row execute function public.enforce_rate_limit('user_id', '30', '5 minutes');

drop trigger if exists trg_rate_limit on public.messages;
create trigger trg_rate_limit before insert on public.messages
  for each row execute function public.enforce_rate_limit('sender_id', '30', '1 minute');

drop trigger if exists trg_rate_limit on public.likes;
create trigger trg_rate_limit before insert on public.likes
  for each row execute function public.enforce_rate_limit('user_id', '120', '5 minutes');

drop trigger if exists trg_rate_limit on public.follows;
create trigger trg_rate_limit before insert on public.follows
  for each row execute function public.enforce_rate_limit('follower_id', '60', '10 minutes');


-- ---------------------------------------------------------------------
-- HATA: stories tablosu (canlı veritabanında eksikti)
-- ---------------------------------------------------------------------
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

drop trigger if exists trg_rate_limit on public.stories;
create trigger trg_rate_limit before insert on public.stories
  for each row execute function public.enforce_rate_limit('user_id', '20', '1 hour');


-- ---------------------------------------------------------------------
-- S-05: Uzunluk ve adres sınırları (NOT VALID: mevcut satırlara dokunmaz,
-- yeni / güncellenen satırlarda uygulanır)
-- ---------------------------------------------------------------------
alter table public.posts drop constraint if exists posts_caption_len_chk;
alter table public.posts add constraint posts_caption_len_chk
  check (char_length(caption) <= 2200) not valid;

alter table public.posts drop constraint if exists posts_tags_len_chk;
alter table public.posts add constraint posts_tags_len_chk
  check (coalesce(array_length(tags, 1), 0) <= 30) not valid;

alter table public.posts drop constraint if exists posts_image_url_chk;
alter table public.posts add constraint posts_image_url_chk
  check (image_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/cat-photos/') not valid;

alter table public.stories drop constraint if exists stories_media_url_chk;
alter table public.stories add constraint stories_media_url_chk
  check (media_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/cat-photos/') not valid;

alter table public.comments drop constraint if exists comments_body_len_chk;
alter table public.comments add constraint comments_body_len_chk
  check (char_length(body) between 1 and 1200) not valid;

alter table public.messages drop constraint if exists messages_content_len_chk;
alter table public.messages add constraint messages_content_len_chk
  check (char_length(content) between 1 and 2200) not valid;

alter table public.profiles drop constraint if exists profiles_text_len_chk;
alter table public.profiles add constraint profiles_text_len_chk
  check (
    char_length(coalesce(name, '')) <= 100
    and char_length(coalesce(breed, '')) <= 100
    and char_length(coalesce(bio, '')) <= 600
  ) not valid;

alter table public.profiles drop constraint if exists profiles_avatar_url_chk;
alter table public.profiles add constraint profiles_avatar_url_chk
  check (
    coalesce(avatar_url, '') = ''
    or avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/'
  ) not valid;


-- ---------------------------------------------------------------------
-- S-06: Kullanılmayan eski konuşma tablolarına yazma kapalı
-- (mesajlar artık sender_id / receiver_id ile messages tablosunda)
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.conversation_members from anon, authenticated;

notify pgrst, 'reload schema';
