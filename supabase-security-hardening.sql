-- NeoCache single-admin policy repair. Run after all existing setup scripts.
-- Removes only the legacy policies observed in the live audit.
-- Atomic and safe to rerun; no collection records or files are changed.
begin;

-- Abort rather than removing the owner's access if the admin setup is missing.
do $$
begin
  if (select count(*) from pg_policies where schemaname='public'
      and policyname in ('neocache_admin_items','neocache_admin_images',
      'neocache_admin_tags','neocache_admin_item_tags','neocache_music_admin',
      'neocache_publications_admin')) <> 6 then
    raise exception 'Required admin policies missing; install the admin setup first';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
      and policyname in ('neocache_admin_storage_select','neocache_admin_storage_insert',
      'neocache_admin_storage_update','neocache_admin_storage_delete')) <> 4 then
    raise exception 'Required storage admin policies missing';
  end if;
end $$;

drop policy if exists "Authenticated users can create items" on public.items;
drop policy if exists "Owners can update items" on public.items;
drop policy if exists "Owners can delete items" on public.items;
drop policy if exists "Owners can create images" on public.images;
drop policy if exists "Owners can update images" on public.images;
drop policy if exists "Owners can delete images" on public.images;
drop policy if exists "Owners can add item tags" on public.item_tags;
drop policy if exists "Owners can delete item tags" on public.item_tags;
drop policy if exists "Authenticated users can create tags" on public.tags;
drop policy if exists "Authenticated users can update tags" on public.tags;
drop policy if exists "Authenticated users can delete tags" on public.tags;
drop policy if exists "Authenticated users can upload images 1ffg0oo_0" on storage.objects;
drop policy if exists "Authenticated users can update images 1ffg0oo_0" on storage.objects;
drop policy if exists "Authenticated users can delete images 1ffg0oo_0" on storage.objects;

-- Remove inherited default write privileges from public-facing application tables.
-- SELECT and authenticated admin DML remain as already configured; RLS restricts DML.
revoke insert, update, delete, truncate, references, trigger on
  public.items, public.images, public.tags, public.item_tags,
  public.music_details, public.publication_details from public, anon;
revoke truncate, references, trigger on
  public.items, public.images, public.tags, public.item_tags,
  public.music_details, public.publication_details from authenticated;

-- Unexpected policies require review; do not silently commit an incomplete repair.
do $$
begin
  if exists (select 1 from pg_policies where
    ((schemaname='public' and tablename in ('items','images','tags','item_tags','music_details','publication_details'))
      or (schemaname='storage' and tablename='objects'))
    and cmd <> 'SELECT'
    and (roles::text <> '{authenticated}'
      or (cmd in ('ALL','UPDATE','DELETE') and coalesce(qual,'') not like '%is_neocache_admin()%')
      or (cmd in ('ALL','INSERT','UPDATE') and coalesce(with_check,'') not like '%is_neocache_admin()%'))) then
    raise exception 'Unexpected non-admin write policy remains; rolling back';
  end if;
end $$;
commit;
