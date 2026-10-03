-- Catstagram World — Faz 3: Kedi avatarı (oyun karakteri) yapılandırması
-- Supabase → SQL Editor → New query → bu dosyanın TAMAMINI yapıştır → Run
-- Idempotent'tir: birden çok kez çalıştırmak güvenlidir.

alter table public.profiles
  add column if not exists avatar_config jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_avatar_config_size_chk;
alter table public.profiles
  add constraint profiles_avatar_config_size_chk
  check (pg_column_size(avatar_config) < 2000);

-- avatar_config, coins/streak'in aksine hassas değil (sunucu tarafında
-- doğrulanan bir ekonomik değer değil, tamamen kozmetik) — kullanıcının
-- kendi satırında doğrudan güncelleyebilmesi güvenli. security_fixes.sql
-- ile revoke edilen geniş UPDATE izninden sonra buraya ayrıca eklenmesi
-- gerekiyor (GRANT'ler kolon bazında birikimli).
grant update (avatar_config) on public.profiles to authenticated;
