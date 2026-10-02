-- NeoCache87 admin access
-- 1. Create your admin user in Supabase Dashboard > Authentication > Users.
-- 2. Copy that user's UUID and replace the zero UUID below.
-- 3. Run this entire file in Supabase Dashboard > SQL Editor.

create or replace function public.is_neocache_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() = '30bd9681-903b-4836-910f-320a81f5ecd9'::uuid;
$$;

grant execute on function public.is_neocache_admin() to authenticated;

alter table public.items enable row level security;
alter table public.images enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;

drop policy if exists "neocache_admin_items" on public.items;
create policy "neocache_admin_items" on public.items
for all to authenticated
using (public.is_neocache_admin())
with check (public.is_neocache_admin());

drop policy if exists "neocache_admin_images" on public.images;
create policy "neocache_admin_images" on public.images
for all to authenticated
using (public.is_neocache_admin())
with check (public.is_neocache_admin());

drop policy if exists "neocache_admin_tags" on public.tags;
create policy "neocache_admin_tags" on public.tags
for all to authenticated
using (public.is_neocache_admin())
with check (public.is_neocache_admin());

drop policy if exists "neocache_admin_item_tags" on public.item_tags;
create policy "neocache_admin_item_tags" on public.item_tags
for all to authenticated
using (public.is_neocache_admin())
with check (public.is_neocache_admin());

drop policy if exists "neocache_admin_storage_select" on storage.objects;
create policy "neocache_admin_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'images' and public.is_neocache_admin());

drop policy if exists "neocache_admin_storage_insert" on storage.objects;
create policy "neocache_admin_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'images' and public.is_neocache_admin());

drop policy if exists "neocache_admin_storage_update" on storage.objects;
create policy "neocache_admin_storage_update" on storage.objects
for update to authenticated
using (bucket_id = 'images' and public.is_neocache_admin())
with check (bucket_id = 'images' and public.is_neocache_admin());

drop policy if exists "neocache_admin_storage_delete" on storage.objects;
create policy "neocache_admin_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'images' and public.is_neocache_admin());
