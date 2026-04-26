-- ============================================================
-- Logo por empresa (storage + columna)
-- ============================================================

alter table empresas add column if not exists logo_url text;

-- Bucket público para logos
insert into storage.buckets (id, name, public)
values ('empresas-logos', 'empresas-logos', true)
on conflict (id) do nothing;

-- Policies sobre storage
drop policy if exists "logos public read" on storage.objects;
create policy "logos public read" on storage.objects
  for select using (bucket_id = 'empresas-logos');

drop policy if exists "logos auth write" on storage.objects;
create policy "logos auth write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empresas-logos');

drop policy if exists "logos auth update" on storage.objects;
create policy "logos auth update" on storage.objects
  for update to authenticated
  using (bucket_id = 'empresas-logos');

drop policy if exists "logos auth delete" on storage.objects;
create policy "logos auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'empresas-logos');
