-- Additive migration: run once in NeoCache after the single-admin setup.
-- No existing records or policies are changed. Any failure rolls back all DDL.
-- Recovery: unpublish scenes or revert the frontend; retain the tables/data.
begin;
set local lock_timeout = '5s';
do $$ begin
  if to_regprocedure('public.is_neocache_admin()') is null then
    raise exception 'Install the administrator guard first';
  end if;
end $$;
create table public.room_tour_scenes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  image_path text not null check (image_path like 'room-tour/%' and image_path not like '%..%'),
  preview_path text not null check (preview_path like 'room-tour/%' and preview_path not like '%..%'),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.room_tour_points (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.room_tour_scenes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  x numeric not null check (x between 0 and 100),
  y numeric not null check (y between 0 and 100),
  unique(scene_id, item_id)
);
create index room_tour_points_item_idx on public.room_tour_points(item_id);
alter table public.room_tour_scenes enable row level security;
alter table public.room_tour_points enable row level security;
revoke all on public.room_tour_scenes, public.room_tour_points from public, anon, authenticated;
grant select on public.room_tour_scenes, public.room_tour_points to anon;
grant select, insert, update, delete on public.room_tour_scenes, public.room_tour_points to authenticated;
create policy tour_scene_read on public.room_tour_scenes for select to anon, authenticated using (published);
create policy tour_scene_admin on public.room_tour_scenes for all to authenticated using (public.is_neocache_admin()) with check (public.is_neocache_admin());
create policy tour_point_read on public.room_tour_points for select to anon, authenticated
using (exists (select 1 from public.room_tour_scenes s where s.id = scene_id and s.published));
create policy tour_point_admin on public.room_tour_points for all to authenticated using (public.is_neocache_admin()) with check (public.is_neocache_admin());
notify pgrst, 'reload schema';
commit;
