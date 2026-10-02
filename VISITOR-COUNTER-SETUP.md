# Persistent visit counter

1. Open Supabase → SQL Editor → New query. Paste the full contents of
   `supabase-visitor-counter-setup.sql` and run it.
2. Upload `visitor-counter.js`, `index.html`, `music.html`, `books.html`,
   `comics.html`, `rooms.html` and `about.html` to Neocities, replacing those files.
   The existing `config.js` must still be present.
3. Open the site. The footer shows VISITS. Reload or navigate to another page:
   your session is counted only once. A new independent browser session adds a visit.

The total starts at zero when enabled; past visits cannot be recovered. Deploys
and rerunning the SQL do not reset it. All six public pages share one total;
admin does not count visits. No Edge Function or new secret is required.

This counts browser tab sessions, not unique people. Session storage persists
across reloads and navigation. Duplicated/restored tabs can share a token. With
session storage blocked, the counter reads the total without incrementing it.
A failed request shows an em dash, not a misleading zero; reload to retry.
The database deduplicates retries, including a response lost after a successful write.

Only random session UUIDs and their creation times are stored by this feature,
not IP addresses or fingerprints. UUID rows are kept to deduplicate restored
sessions. Supabase may retain its normal infrastructure request logs separately.
This is a lightweight public counter, not bot-resistant analytics: automated
requests or someone generating fresh UUIDs can inflate it, and owners' visits count.

## Database review and rollback

RLS is enabled with no public table policies or table grants. Public callers can
only execute the function, which returns the total and accepts a session UUID.
The security-definer function uses an empty search path and qualified tables.
UUID uniqueness deduplicates concurrent retries; the total is incremented
atomically in the same transaction as inserting the session. A failure rolls
both changes back. The singleton and nonnegative checks protect the total.

To disable, remove the script and counter markup from the public pages and
redeploy. Keep the database tables to preserve history. Optionally revoke
function execution from anon and authenticated. Do not delete or truncate the
tables unless deliberately resetting the history.

Automated browser tests mock this RPC and never write to production. They do
not prove that this SQL was applied; verify the counter after running the SQL.
