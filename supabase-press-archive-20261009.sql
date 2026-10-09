-- Additive migration; run once after the single-administrator setup.
-- New empty tables and a private bucket; existing collection data is untouched.
-- Verify with tests/sql/press-archive-regression.sql and security-regression.sql.
-- Recovery: unpublish articles/revert frontend; retain tables and files.
begin;
set local lock_timeout = '5s';
do $$ begin
  if to_regprocedure('public.is_neocache_admin()') is null then
    raise exception 'Install the administrator guard first';
  end if;
end $$;
create table public.press_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 240),
  publication text not null default '' check (length(publication) <= 160),
  year integer check (year between 1900 and 2100),
  publication_date date,
  language text not null check (length(btrim(language)) between 1 and 80),
  article_type text not null check (article_type in ('Interview','Review','News','Feature','Advertisement','Other')),
  description text not null default '' check (length(description) <= 10000),
  notes text not null default '' check (length(notes) <= 10000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (publication_date is null or (year is not null and extract(year from publication_date) = year))
);
create table public.press_pages (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.press_articles(id) on delete cascade,
  path text not null unique,
  caption text not null default '' check (length(caption) <= 500),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  check (path ~ ('^' || article_id::text || '/[a-zA-Z0-9-]+\.(jpg|png|webp)$'))
);
create index press_pages_article_idx on public.press_pages(article_id);
alter table public.press_articles enable row level security;
alter table public.press_pages enable row level security;
revoke all on public.press_articles, public.press_pages from public, anon, authenticated;
grant select on public.press_articles, public.press_pages to anon;
grant select, insert, update, delete on public.press_articles, public.press_pages to authenticated;
create policy press_article_read on public.press_articles for select to anon, authenticated using (published);
create policy press_article_admin on public.press_articles for all to authenticated using (public.is_neocache_admin()) with check (public.is_neocache_admin());
create policy press_page_read on public.press_pages for select to anon, authenticated
using (exists (select 1 from public.press_articles a where a.id = article_id and a.published));
create policy press_page_admin on public.press_pages for all to authenticated using (public.is_neocache_admin()) with check (public.is_neocache_admin());
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('press', 'press', false, 20971520, array['image/jpeg','image/png','image/webp']);
create policy press_storage_read on storage.objects for select to anon, authenticated
using (bucket_id = 'press' and exists (
  select 1 from public.press_pages p join public.press_articles a on a.id = p.article_id
  where p.path = name and a.published
));
create policy press_storage_admin on storage.objects for all to authenticated
using (bucket_id = 'press' and public.is_neocache_admin())
with check (bucket_id = 'press' and public.is_neocache_admin());
-- Restrict this bucket even if other permissive Storage readers are added later.
create policy press_storage_boundary on storage.objects as restrictive for select to anon, authenticated
using (bucket_id <> 'press' or exists (
  select 1 from public.press_pages p where p.path = name
) or (auth.role() = 'authenticated' and public.is_neocache_admin()));
notify pgrst, 'reload schema';
commit;
