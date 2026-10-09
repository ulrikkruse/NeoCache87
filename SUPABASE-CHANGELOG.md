# Supabase operation log

## 2026-10-09 — Press Archive installed

- Project: `zdozxuxouuwmpkajoign` (NeoCache), through the connected Supabase integration.
- Applied the exact `supabase-press-archive-20261009.sql` from commit `87ae74f`,
  using migration name `press_archive_20261009`. Result: `success: true`.
- Preflight confirmed both new tables and the press bucket were absent and
  the administrator guard existed. Existing Storage policies were scoped to
  images/memories, with writes restricted to the administrator.
- `tests/sql/press-archive-regression.sql`: PASS for tables, RLS, grants,
  constraints and private scan bucket.
- `tests/sql/security-regression.sql`: PASS for existing public reads,
  administrator-only policies and private-table grants.
- Read-only counts confirmed zero press articles, pages and stored files.
  No synthetic records or scans were written to production. Browser workflows
  were tested with mocked services; live checks inspect actual database policies.

## 2026-10-04 — Memory Lane installed

- Project: `zdozxuxouuwmpkajoign` (NeoCache), through Safari SQL Editor.
- Applied `supabase-memory-lane-20261004.sql` from commit `43d5f61`.
- Preflight confirmed both new tables and the memories bucket were absent,
  `items.id` is UUID, and the administrator guard exists. Existing Storage
  policies were scoped to the images bucket and the administrator.
- Migration result: `Success. No rows returned`.
- `tests/sql/memory-lane-regression.sql`: PASS for tables, RLS, grants,
  constraints and the private photo bucket.
- `tests/sql/security-regression.sql`: PASS for existing RLS, public reads,
  admin-only policies and private-table grants.
- No synthetic memories, photographs or collection records were added to
  production. Admin workflows are covered by offline browser tests; live
  policy verification used read-only catalog checks, not test data.

## 2026-10-03 — Room Tour installed

- Project: `zdozxuxouuwmpkajoign` (NeoCache), through Safari SQL Editor.
- Applied `supabase-room-tour-20261003.sql` from commit `fa5f90b`.
- Preflight confirmed the tour scene table did not exist, `items.id` is UUID,
  and the existing administrator guard is present.
- Migration result: `Success. No rows returned`.
- `tests/sql/room-tour-regression.sql`: PASS for Room Tour RLS, publication
  policies, grants and constraints.
- `tests/sql/security-regression.sql`: PASS for existing application and Storage
  policies, public reads, admin-only writes and private table isolation.
- Created two empty tables only; no sample photos, markers or collection records
  were inserted. Admin upload and editing were tested with mocked services, not
  production writes. The first real view is added by the owner in admin.

This log starts with the access check below. It does not reconstruct the complete
history of the existing database. Record future executed migrations and their
verification here; do not list a prepared migration as applied.

## 2026-10-02 — Browser SQL access verified

- Project: `zdozxuxouuwmpkajoign` (NeoCache).
- Route: signed-in Safari, Supabase SQL Editor, primary database.
- Executed query:

```sql
begin read only;
select current_database() as database_name, current_user as execution_role,
  to_regclass('public.items') is not null as items_available,
  to_regprocedure('public.is_neocache_admin()') is not null as admin_guard_available;
commit;
```

- Observed result: `postgres`, `postgres`, `true`, `true`.
- No schema or collection data changed. This verifies query execution through
  the current browser session, not permanent access or a fresh full RLS audit.
