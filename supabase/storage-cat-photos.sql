-- Optional: run if your public `cat-photos` bucket needs RLS policies.
-- Bucket must already exist (Dashboard → Storage → cat-photos, Public).

insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Cat photos are publicly accessible" on storage.objects;
create policy "Cat photos are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'cat-photos');

drop policy if exists "Authenticated users can upload cat photos" on storage.objects;
create policy "Authenticated users can upload cat photos"
  on storage.objects for insert
  with check (
    bucket_id = 'cat-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Users can update cat photos" on storage.objects;
create policy "Users can update cat photos"
  on storage.objects for update
  using (
    bucket_id = 'cat-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Users can delete cat photos" on storage.objects;
create policy "Users can delete cat photos"
  on storage.objects for delete
  using (
    bucket_id = 'cat-photos'
    and auth.role() = 'authenticated'
  );
