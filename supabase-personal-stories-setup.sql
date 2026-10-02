-- Additive migration: existing rows and their access policies are preserved.
begin;
alter table public.items add column if not exists personal_story text;
comment on column public.items.personal_story is 'Public personal story displayed on ARCHIVE item details only.';
commit;
-- Existing items RLS and grants apply to this column, including admin updates.
-- To roll back the UI, restore the previous website files; keep the column to
-- preserve stories. Dropping the column would permanently delete those stories.
