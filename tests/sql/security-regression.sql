-- Read-only regression checks: run in Supabase SQL Editor after security changes.
-- Raises an exception if permissive legacy writers or table grants return.
begin read only;
do $$
declare t text; r text;
begin
  foreach t in array array['items','images','tags','item_tags','music_details','publication_details'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then
      raise exception 'RLS disabled: %',t;
    end if;
    if not has_table_privilege('anon','public.'||t,'SELECT') then
      raise exception 'Public read grant missing: %',t;
    end if;
    if has_table_privilege('anon','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'Anonymous write grant: %',t;
    end if;
    if has_table_privilege('authenticated','public.'||t,'TRUNCATE') then
      raise exception 'Authenticated truncate grant: %',t;
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and cmd='SELECT') then
      raise exception 'Public read policy missing: %',t;
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and cmd='ALL'
      and roles::text='{authenticated}' and qual='is_neocache_admin()' and with_check='is_neocache_admin()') then
      raise exception 'Admin policy missing or changed: %',t;
    end if;
  end loop;
  if exists(select 1 from pg_policies where
    ((schemaname='public' and tablename in ('items','images','tags','item_tags','music_details','publication_details'))
    or (schemaname='storage' and tablename='objects')) and cmd<>'SELECT'
    and (roles::text<>'{authenticated}'
      or (cmd in ('ALL','UPDATE','DELETE') and coalesce(qual,'') not like '%is_neocache_admin()%')
      or (cmd in ('ALL','INSERT','UPDATE') and coalesce(with_check,'') not like '%is_neocache_admin()%'))) then
    raise exception 'Non-admin write policy detected';
  end if;
  foreach t in array array['music_lookup_cache','music_lookup_throttle','publication_lookup_cache','publication_lookup_throttle','site_visit_total','site_visit_sessions'] loop
    foreach r in array array['anon','authenticated'] loop
      if has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
        raise exception 'Private table exposed: % to %',t,r;
      end if;
    end loop;
  end loop;
end $$;
select 'PASS: RLS, public reads, admin-only policies and private-table grants' as result;
rollback;
