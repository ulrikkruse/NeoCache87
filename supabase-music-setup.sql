-- Run after supabase-admin-setup.sql in Supabase SQL Editor.
-- One row per physical music item; multiple copies may share identifiers.
begin;

create table if not exists public.music_details (
  item_id uuid primary key references public.items(id) on delete cascade,
  artist text not null check (length(trim(artist)) > 0),
  format text not null check (length(trim(format)) > 0),
  label text,
  catalog_number text,
  barcode text check (barcode ~ '^([0-9]{8}|[0-9]{12,14})$'),
  country text,
  edition text,
  matrix text,
  media_condition text,
  sleeve_condition text,
  discogs_release_id text check (discogs_release_id ~ '^[0-9]+$')
);

alter table public.music_details enable row level security;
grant select on public.music_details to anon, authenticated;
grant insert, update, delete on public.music_details to authenticated;

drop policy if exists neocache_music_read on public.music_details;
create policy neocache_music_read on public.music_details
for select to anon, authenticated
using (exists (select 1 from public.items where items.id = music_details.item_id));

drop policy if exists neocache_music_admin on public.music_details;
create policy neocache_music_admin on public.music_details
for all to authenticated
using (public.is_neocache_admin())
with check (public.is_neocache_admin());

notify pgrst, 'reload schema';
commit;
