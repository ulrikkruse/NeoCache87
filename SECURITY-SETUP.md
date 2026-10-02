# Single-admin access

Run all original setup scripts, then `supabase-security-hardening.sql` last.
Existing permissive policies are combined with OR: adding an admin policy does
not cancel a legacy policy allowing every authenticated user to write.
The hardening script removes the fourteen legacy policies identified in the audit,
keeps public reads and admin policies, and narrows application table grants.
Supabase-managed Storage grants are unchanged; Storage writes are restricted by
its policies. No collection rows, images or constraints are changed.

In Supabase Authentication → Sign In / Providers, disable **Allow new users to
sign up** and save. Keep email login enabled for the existing administrator.
This setting is separate from SQL and must be checked for each environment.

Run `tests/sql/security-regression.sql` in SQL Editor after any policy changes.
It is read-only, fails on broad writers/grants and verifies private-table isolation.
The offline/browser suite mocks Supabase and cannot execute this live SQL check.
The SQL test does not establish that all application workflows work for a real
signed-in administrator; check actual access independently after deploying.

The repair uses a transaction and aborts if required admin policies are absent
or unexpected broad policies remain. Failure rolls back the entire repair.
Do not restore the broad legacy policies as a rollback. If a future workflow
needs access, introduce and review a narrowly scoped policy instead.

No Neocities upload or Edge Function redeployment is needed for this repair.
