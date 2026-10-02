-- Run once in Supabase SQL Editor. Safe to rerun: existing totals are preserved.
begin;

create table if not exists public.site_visit_total (
  id boolean primary key default true check (id),
  total bigint not null default 0 check (total >= 0)
);
insert into public.site_visit_total (id, total) values (true, 0)
on conflict (id) do nothing;

create table if not exists public.site_visit_sessions (
  visit_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.site_visit_total enable row level security;
alter table public.site_visit_sessions enable row level security;
revoke all on public.site_visit_total, public.site_visit_sessions from public, anon, authenticated;

create or replace function public.register_visit(p_visit_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  current_total bigint;
begin
  if p_visit_id is not null then
    insert into public.site_visit_sessions (visit_id) values (p_visit_id)
    on conflict (visit_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count = 1 then
      update public.site_visit_total set total = total + 1 where id = true;
    end if;
  end if;
  select total into current_total from public.site_visit_total where id = true;
  return current_total;
end;
$$;
revoke all on function public.register_visit(uuid) from public;
grant execute on function public.register_visit(uuid) to anon, authenticated;
commit;
