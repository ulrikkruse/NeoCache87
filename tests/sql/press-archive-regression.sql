-- Read-only live verification. No synthetic records are written.
begin read only;
do $$
declare t text;
begin
  foreach t in array array['press_articles','press_pages'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS missing: %',t; end if;
    if has_table_privilege('anon','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('authenticated','public.'||t,'TRUNCATE') then raise exception 'Unsafe grants: %',t; end if;
    if not has_table_privilege('anon','public.'||t,'SELECT') then raise exception 'Read grant missing: %',t; end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=t) <> 2 then raise exception 'Unexpected policies: %',t; end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and cmd='ALL' and roles::text='{authenticated}' and qual='is_neocache_admin()' and with_check='is_neocache_admin()') then raise exception 'Admin guard missing: %',t; end if;
  end loop;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='press_articles' and cmd='SELECT' and qual='published') then raise exception 'Draft article policy missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='press_pages' and cmd='SELECT' and qual like '%a.published%') then raise exception 'Draft page policy missing'; end if;
  if not exists(select 1 from storage.buckets where id='press' and not public and file_size_limit=20971520 and allowed_mime_types=array['image/jpeg','image/png','image/webp']) then raise exception 'Private bucket configuration missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='press_storage_read' and cmd='SELECT' and qual like '%a.published%' and qual like '%bucket_id%press%') then raise exception 'Published image read policy missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='press_storage_boundary' and permissive='RESTRICTIVE' and cmd='SELECT' and qual like '%press_pages%' and qual like '%bucket_id%press%') then raise exception 'Storage isolation missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='press_storage_admin' and cmd='ALL' and roles::text='{authenticated}' and qual like '%is_neocache_admin()%' and with_check like '%is_neocache_admin()%') then raise exception 'Storage admin guard missing'; end if;
  if (select count(*) from pg_constraint where conrelid='public.press_pages'::regclass and contype='f') <> 1 then raise exception 'Photo foreign key missing'; end if;
  if (select count(*) from pg_constraint where conrelid='public.press_pages'::regclass and contype='c') <> 3 then raise exception 'Photo constraints missing'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.press_pages'::regclass and contype='u') then raise exception 'Unique photo path missing'; end if;
  if (select count(*) from pg_constraint where conrelid='public.press_articles'::regclass and contype='c') <> 8 then raise exception 'Article constraints missing'; end if;
end $$;
select 'PASS: Press Archive tables, RLS, grants, constraints and private photo bucket' as result;
rollback;
