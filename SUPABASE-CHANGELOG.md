# Supabase operation log

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
