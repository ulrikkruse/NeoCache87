-- Run after supabase-admin-setup.sql. Existing music tables are unchanged.
begin;
create table if not exists public.publication_details (
 item_id uuid primary key references public.items(id) on delete cascade,
 kind text not null check (kind in ('books','comics')),
 author text,
 format text not null check (length(trim(format)) > 0),
 publisher text, language text, edition text,
 isbn text check (isbn ~ '^([0-9]{9}[0-9X]|97[89][0-9]{10})$'),
 series text, issue text, illustrator text,
 openlibrary_id text check (openlibrary_id ~ '^OL[0-9]+M$')
);
alter table public.publication_details enable row level security;
grant select on public.publication_details to anon, authenticated;
grant insert, update, delete on public.publication_details to authenticated;
drop policy if exists neocache_publications_read on public.publication_details;
create policy neocache_publications_read on public.publication_details for select to anon, authenticated
using (exists(select 1 from public.items where items.id = publication_details.item_id));
drop policy if exists neocache_publications_admin on public.publication_details;
create policy neocache_publications_admin on public.publication_details for all to authenticated
using (public.is_neocache_admin()) with check (public.is_neocache_admin());
create table if not exists public.publication_lookup_cache (
  query text primary key,
  payload jsonb not null,
  expires_at timestamptz not null
);
create table if not exists public.publication_lookup_throttle (
  id boolean primary key default true check (id),
  next_at timestamptz not null default now()
);
insert into public.publication_lookup_throttle (id) values (true) on conflict do nothing;
alter table public.publication_lookup_cache enable row level security;
alter table public.publication_lookup_throttle enable row level security;
revoke all on public.publication_lookup_cache, public.publication_lookup_throttle from anon, authenticated;
grant all on public.publication_lookup_cache, public.publication_lookup_throttle to service_role;
create or replace function public.claim_publication_lookup() returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.publication_lookup_throttle set next_at = clock_timestamp() + interval '1100 milliseconds'
  where id = true and next_at <= clock_timestamp();
  return found;
end;
$$;
revoke all on function public.claim_publication_lookup() from public, anon, authenticated;
grant execute on function public.claim_publication_lookup() to service_role;
notify pgrst, 'reload schema';
commit;
