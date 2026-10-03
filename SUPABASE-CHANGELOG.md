# Supabase operation log

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
