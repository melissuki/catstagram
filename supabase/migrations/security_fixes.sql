-- =====================================================================
-- GÜVENLİK DÜZELTMELERİ — Pentest raporu (VULN-02 ve VULN-04)
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir: birden çok kez çalıştırmak güvenlidir.
-- =====================================================================


-- ---------------------------------------------------------------------
-- VULN-02 (KRİTİK) — Skor / mama serisi manipülasyonu
--
-- Sorun: profiles UPDATE politikası kullanıcının KENDİ satırındaki HER
-- alanı değiştirmesine izin veriyordu; game_high_score'u doğrudan 999999
-- yapabiliyordun. Çözüm iki katman:
--   (A) Kullanıcı rolüne SADECE düzenlenebilir kolonlarda UPDATE izni ver.
--       Böylece game_high_score / food_streak / last_fed_date'e doğrudan
--       PATCH atmak veritabanı seviyesinde reddedilir.
--   (B) Skor ve besleme, sunucu tarafında doğrulayan SECURITY DEFINER
--       fonksiyonları (RPC) üzerinden güncellenir.
-- ---------------------------------------------------------------------

-- (A) Kolon seviyesinde UPDATE yetkisi
-- Önce geniş UPDATE iznini geri al, sonra yalnızca güvenli kolonları ver.
revoke update on public.profiles from anon, authenticated;

grant update (name, breed, age, bio, avatar_url, username)
  on public.profiles to authenticated;

-- (SELECT ve INSERT dokunulmadı; mevcut RLS politikaları geçerliliğini korur.)


-- (B1) Oyun skoru: yalnızca artışa izin veren, üst sınırı olan RPC.
-- NOT: max_score (200000) senin oyununun ulaşılabilir tavanına göre
-- ayarlanmalı. Sunucu oyunu birebir simüle etmediği için bu, "makul
-- tavan + yalnızca yükselme" şeklinde pratik bir korumadır.
create or replace function public.update_game_high_score(new_score integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  current_score integer;
  max_score constant integer := 200000;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if new_score is null or new_score < 0 or new_score > max_score then
    raise exception 'Invalid score';
  end if;

  select game_high_score into current_score
  from public.profiles where id = me;

  if new_score > current_score then
    update public.profiles
      set game_high_score = new_score
      where id = me;
    return new_score;
  end if;

  return current_score;
end;
$$;

grant execute on function public.update_game_high_score(integer) to authenticated;


-- (B2) Mama serisi: streak'i sunucu, tarihe göre HESAPLAR. İstemci
-- doğrudan food_streak yazamaz; sadece "besle" der.
create or replace function public.feed_cat()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  prof public.profiles;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into prof from public.profiles where id = me;

  if prof.last_fed_date = current_date then
    return prof;                          -- bugün zaten beslenmiş
  elsif prof.last_fed_date = current_date - 1 then
    update public.profiles                -- seri devam ediyor
      set food_streak = food_streak + 1, last_fed_date = current_date
      where id = me returning * into prof;
  else
    update public.profiles                -- seri sıfırlandı, yeniden başla
      set food_streak = 1, last_fed_date = current_date
      where id = me returning * into prof;
  end if;

  return prof;
end;
$$;

grant execute on function public.feed_cat() to authenticated;


-- ---------------------------------------------------------------------
-- VULN-04 (ORTA) — E-posta (PII) ifşası
--
-- Sorun: profiles tablosu herkese okunuyordu (RLS select using(true)) ve
-- içinde e-posta vardı; giriş yapan herkes tüm kullanıcıların e-postasını
-- çekebiliyordu. Uygulama e-postayı profiles'tan HİÇ okumuyor (giriş
-- e-postası auth.users'tan geliyor), bu yüzden kolonu tamamen kaldırmak
-- en temiz ve kırmadan çözüm. (E-posta auth.users'ta güvende kalır.)
-- ---------------------------------------------------------------------

-- Yeni kayıtlarda e-postayı artık profiles'a yazma.
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

  while exists (select 1 from public.profiles p where p.username = uname) loop
    uname := left(uname, 16) || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username, name, breed, age, bio, avatar_url)
  values (
    new.id,
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

-- E-posta kolonunu profiles'tan kaldır (auth.users'ta zaten mevcut).
alter table public.profiles drop column if exists email;
