-- Read-only live verification after the Room Tour migration; no test rows.
begin read only;
do $$
declare t text;
begin
  foreach t in array array['room_tour_scenes','room_tour_points'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS missing: %',t; end if;
    if has_table_privilege('anon','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('authenticated','public.'||t,'TRUNCATE') then raise exception 'Unsafe grants: %',t; end if;
    if not has_table_privilege('anon','public.'||t,'SELECT') then raise exception 'Public read missing: %',t; end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=t) <> 2 then raise exception 'Unexpected policy count: %',t; end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and cmd='ALL' and roles::text='{authenticated}' and qual='is_neocache_admin()' and with_check='is_neocache_admin()') then raise exception 'Admin policy missing: %',t; end if;
  end loop;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='room_tour_scenes' and cmd='SELECT' and qual='published') then raise exception 'Unpublished scenes may be exposed'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='room_tour_points' and cmd='SELECT' and qual like '%s.published%') then raise exception 'Unpublished markers may be exposed'; end if;
  if (select count(*) from pg_constraint where conrelid='public.room_tour_points'::regclass and contype='f') <> 2 then raise exception 'Foreign keys missing'; end if;
  if (select count(*) from pg_constraint where conrelid='public.room_tour_points'::regclass and contype='c') <> 2 then raise exception 'Coordinate constraints missing'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.room_tour_points'::regclass and contype='u') then raise exception 'Duplicate marker constraint missing'; end if;
end $$;
select 'PASS: Room Tour RLS, publication policies, grants and constraints' as result;
rollback;
