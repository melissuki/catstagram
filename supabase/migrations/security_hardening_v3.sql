-- =====================================================================
-- GÜVENLİK SERTLEŞTİRMESİ v3 — yayın öncesi kontrol
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir. security_hardening_v2.sql'den SONRA çalıştır.
--
-- ÖNEMLİ: Bu dosyayı, uygulamanın bu dosyayla birlikte gelen sürümü
-- (profil sorgularında açık kolon listesi kullanan sürüm) canlıya
-- alındıktan SONRA çalıştır. Eski sürüm profilleri select('*') ile okuyor.
--
-- Düzeltilenler:
--   K-01 Kayıt tetikleyicisi (handle_new_user) bozuk / beklenmedik bir
--        girdiyle çöküyordu ("Database error saving new user"): ondalıklı
--        veya negatif yaş, çok uzun isim, aynı anda aynı kullanıcı adıyla
--        kayıt. Artık her girdi temizlenip sınırlanıyor; kayıt çökmüyor.
--        Kayıt sırasında dışarıdan profil fotoğrafı adresi verilemiyor.
--   V-01 Veri sızıntısı: herkesin son giriş tarihi (login_streak_last_date)
--        ve eski besleme tarihi herkese açıktı. Artık istemci okuyamaz.
--   S-07 Fotoğraf deposu SVG kabul ediyordu (içine script gömülebilir).
--        Artık yalnızca JPEG, PNG, WebP, GIF, HEIC/HEIF, AVIF.
--   S-08 Kullanılmayan create_conversation_with() fonksiyonu kapatıldı.
--   S-09 Yaş için üst sınır (0–40).
-- =====================================================================


-- ---------------------------------------------------------------------
-- K-01: Sağlam kayıt tetikleyicisi
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text;
  base text;
  age_raw text;
  age_val integer := 1;
  clean_name text;
  clean_breed text;
  clean_bio text;
  attempt integer := 0;
begin
  -- Kullanıcı adı: yalnızca a-z 0-9 _ , 3–24 karakter
  uname := lower(coalesce(meta ->> 'username', split_part(new.email, '@', 1), ''));
  uname := regexp_replace(uname, '[^a-z0-9_]', '', 'g');
  if length(uname) < 3 then
    uname := 'cat_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  uname := left(uname, 24);
  base := left(uname, 19);

  -- Yaş: sayı değilse 1; tam sayıya yuvarla; 0–40
  age_raw := btrim(coalesce(meta ->> 'age', ''));
  if age_raw ~ '^-?[0-9]{1,6}(\.[0-9]+)?$' then
    age_val := greatest(0, least(40, round(age_raw::numeric)::integer));
  end if;

  -- Metinler: kontrol karakterleri temizlenir, uzunluk sınırlanır
  clean_name := left(btrim(regexp_replace(coalesce(meta ->> 'name', ''), '[[:cntrl:]]', '', 'g')), 80);
  if clean_name = '' then
    clean_name := left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Cat'), 80);
  end if;
  clean_breed := left(btrim(regexp_replace(coalesce(meta ->> 'breed', ''), '[[:cntrl:]]', '', 'g')), 80);
  if clean_breed = '' then
    clean_breed := 'Mixed';
  end if;
  clean_bio := left(btrim(regexp_replace(coalesce(meta ->> 'bio', ''), '[[:cntrl:]]', ' ', 'g')), 500);

  -- Kullanıcı adı alınmışsa (ya da aynı anda biri aldıysa) sonek ekle
  loop
    attempt := attempt + 1;
    if attempt > 30 then
      raise exception 'Could not allocate a username';
    end if;
    if exists (select 1 from public.profiles p where p.username = uname) then
      uname := base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
      if attempt > 20 then
        uname := 'cat_' || substr(replace(new.id::text, '-', ''), 1, 20);
      end if;
      continue;
    end if;

    begin
      insert into public.profiles (id, username, name, breed, age, bio, avatar_url)
      values (new.id, uname, clean_name, clean_breed, age_val, clean_bio, '')
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      uname := base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    end;
  end loop;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- S-09: yaş üst sınırı (mevcut satırların hepsi uygun)
alter table public.profiles drop constraint if exists profiles_age_range_chk;
alter table public.profiles add constraint profiles_age_range_chk
  check (age between 0 and 40) not valid;


-- ---------------------------------------------------------------------
-- V-01: Özel kolonlar istemciye kapalı
-- Tablo seviyesindeki SELECT izni kaldırılıp yalnızca herkese açık
-- kolonlara izin verilir. (Sunucu fonksiyonları etkilenmez.)
-- ---------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;

do $$
declare
  cols text;
begin
  -- Yalnızca gerçekten var olan kolonlara izin ver (eski şemalarla uyumlu)
  select string_agg(quote_ident(column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name in (
      'id', 'username', 'name', 'breed', 'age', 'bio', 'avatar_url',
      'game_high_score', 'coins', 'post_streak_count', 'post_streak_last_date',
      'login_streak_count', 'avatar_config', 'created_at', 'updated_at'
    );

  execute format('grant select (%s) on public.profiles to anon, authenticated', cols);
end $$;


-- ---------------------------------------------------------------------
-- S-07: Yalnızca raster görseller (SVG yok)
-- ---------------------------------------------------------------------
update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif', 'image/avif'
      ]
  where id = 'cat-photos';


-- ---------------------------------------------------------------------
-- S-08: Kullanılmayan eski konuşma fonksiyonu
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.create_conversation_with(uuid)') is not null then
    revoke execute on function public.create_conversation_with(uuid) from public, anon, authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
