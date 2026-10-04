-- Run once after the single-administrator setup. Additive, transactional migration.
-- Draft photos live in a PRIVATE bucket; only photos of published memories are public-readable.
-- Verify with tests/sql/memory-lane-regression.sql and tests/sql/security-regression.sql.
-- Recovery: unpublish memories and revert frontend; retain tables/bucket to preserve photos.
begin;
set local lock_timeout = '5s';
do $$ begin
  if to_regprocedure('public.is_neocache_admin()') is null then
    raise exception 'Install the administrator guard first';
  end if;
end $$;
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  period text not null default '' check (length(period) <= 80),
  place text not null default '' check (length(place) <= 160),
  theme text not null default '' check (length(theme) <= 80),
  body text not null check (length(btrim(body)) between 1 and 30000),
  related_item_id uuid references public.items(id) on delete set null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  path text not null unique,
  caption text not null default '' check (length(caption) <= 500),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  check (path ~ ('^' || memory_id::text || '/[a-zA-Z0-9-]+\.(jpg|png|webp)$'))
);
create index memories_item_idx on public.memories(related_item_id);
create index memory_photos_memory_idx on public.memory_photos(memory_id);
alter table public.memories enable row level security;
alter table public.memory_photos enable row level security;
revoke all on public.memories, public.memory_photos from public, anon, authenticated;
grant select on public.memories, public.memory_photos to anon;
grant select, insert, update, delete on public.memories, public.memory_photos to authenticated;
create policy memory_read on public.memories for select to anon, authenticated using (published);
create policy memory_admin on public.memories for all to authenticated using (public.is_neocache_admin()) with check (public.is_neocache_admin());
create policy memory_photo_read on public.memory_photos for select to anon, authenticated
using (exists (select 1 from public.memories m where m.id = memory_id and m.published));
create policy memory_photo_admin on public.memory_photos for all to authenticated using (public.is_neocache_admin()) with check (public.is_neocache_admin());
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 20971520, array['image/jpeg','image/png','image/webp']);
create policy memory_storage_read on storage.objects for select to anon, authenticated
using (bucket_id = 'memories' and exists (
  select 1 from public.memory_photos p join public.memories m on m.id = p.memory_id
  where p.path = name and m.published
));
create policy memory_storage_admin on storage.objects for all to authenticated
using (bucket_id = 'memories' and public.is_neocache_admin())
with check (bucket_id = 'memories' and public.is_neocache_admin());
-- Existing permissive SELECT policies must never expose private draft photos.
create policy memory_storage_boundary on storage.objects as restrictive for select to anon, authenticated
using (bucket_id <> 'memories' or exists (
  select 1 from public.memory_photos p where p.path = name
) or (auth.role() = 'authenticated' and public.is_neocache_admin()));
notify pgrst, 'reload schema';
commit;
