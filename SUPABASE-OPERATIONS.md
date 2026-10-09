# Supabase operations

## Target and access

- Project: NeoCache
- Project reference: `zdozxuxouuwmpkajoign`
- SQL Editor: https://supabase.com/dashboard/project/zdozxuxouuwmpkajoign/sql/new
- Current execution route: the connected Supabase integration (`apply_migration`
  for DDL, `execute_sql` for read-only verification).
- Fallback when available: the user's signed-in Safari session through the
  Supabase dashboard SQL Editor.

The user authorizes routine SQL schema changes and fixes needed for requested
NeoCache work. Ask before deleting existing data or making a change with material
risk. Do not treat this as permission to make unrelated database changes or to
broaden access. Authentication settings and Edge Functions are separate operations.

This is an agent-operated workflow, not an unattended SQL deployment service.
Access depends on the Supabase integration remaining connected, or on an available
signed-in browser session. If access expires, ask the user to reconnect or sign in. Do not extract browser cookies or
tokens, store database passwords in this repository, or use the public `anon` key
as an administrative credential. The Neocities key cannot execute Supabase SQL.

## Change workflow

1. Inspect the actual schema and policies relevant to the requested change in
   the named project. Existing setup files do not prove the current live state.
2. Save each new incremental change in a descriptive, dated SQL file in Git.
   Document prerequisites, intended effect, verification and recovery. Review
   constraints, grants and RLS using the existing project requirements. Do not
   rerun all historical setup files; they can restore obsolete permissions.
3. Use a transaction for compatible operations, with explicit preconditions and
   postconditions that abort on an unexpected state. Identify nontransactional
   operations and their recovery plan separately. Prefer a corrective forward
   migration over a rollback that loses data or restores insecure policies.
4. Complete the required regression checks and review the exact SQL before
   execution. Commit and push the reviewed migration so the executed version is
   identifiable. Offline tests mock Supabase; they are not live SQL verification.
5. Verify the project identity. With the connected integration, apply the exact
   reviewed SQL through `apply_migration`, using a descriptive migration name.
   Alternatively open a new SQL Editor query, check the project URL, database
   target and role, paste the reviewed SQL and execute the full transaction.
   Read the result; a timeout or lost connection is not proof of success or failure.
6. Verify the affected schema and policies with read-only queries. Run the
   existing `tests/sql/security-regression.sql` after policy/grant changes. Do not
   create synthetic records in the production database for testing. If execution
   is uncertain, inspect the state before retrying a migration.
7. Record the outcome in `SUPABASE-CHANGELOG.md`, including migration path, commit,
   project, verification and any limitations. Commit and push that record. Report
   live execution separately from Git push, local tests and Neocities deployment.

Coordinate deployment order with website changes. Prefer backward-compatible
database additions before deploying frontend code that depends on them. A failed
migration must not be followed by uploading code that requires it.

## Existing scripts

The root `supabase-*-setup.sql` files are historical incremental setup scripts,
not a complete database bootstrap or a verified migration ledger. Preserve them
for reference. `supabase-security-hardening.sql` removes legacy broad policies;
do not undo that protection by rerunning earlier policy definitions blindly.

See [SECURITY-SETUP.md](SECURITY-SETUP.md) for current access expectations and
[AGENTS.md](AGENTS.md) for required regression checks and publishing rules.
