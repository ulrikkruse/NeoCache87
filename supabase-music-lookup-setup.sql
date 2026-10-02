-- Run after supabase-music-setup.sql.
begin;
alter table public.music_details add column if not exists musicbrainz_release_id uuid;
create table if not exists public.music_lookup_cache (
  query text primary key,
  payload jsonb not null,
  expires_at timestamptz not null
);
create table if not exists public.music_lookup_throttle (
  id boolean primary key default true check (id),
  next_at timestamptz not null default now()
);
insert into public.music_lookup_throttle (id) values (true) on conflict do nothing;
alter table public.music_lookup_cache enable row level security;
alter table public.music_lookup_throttle enable row level security;
revoke all on public.music_lookup_cache, public.music_lookup_throttle from anon, authenticated;
grant all on public.music_lookup_cache, public.music_lookup_throttle to service_role;
create or replace function public.claim_music_lookup() returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.music_lookup_throttle set next_at = clock_timestamp() + interval '1100 milliseconds'
  where id = true and next_at <= clock_timestamp();
  return found;
end;
$$;
revoke all on function public.claim_music_lookup() from public, anon, authenticated;
grant execute on function public.claim_music_lookup() to service_role;
notify pgrst, 'reload schema';
commit;
