# Deploy to Neocities

The user authorizes deployment of completed, tested changes to `neocache87` after
committing and pushing. Deployment uploads only the explicit website manifest in
`scripts/deploy-neocities.mjs`. It never deletes remote files or deploys Supabase.

## One-time setup

In Neocities Settings, select the site and find its API key. Save it locally in
`.env.neocities` in the project root:

```dotenv
NEOCITIES_API_KEY=your-api-key
```

This file is ignored by Git. Do not upload it, paste it into chat, include it in a
screenshot, or commit it. It grants access to the site. The environment variable
`NEOCITIES_API_KEY` is also supported and takes precedence over the local file.
The script never prints the key or raw API error responses.

Memory Lane requires its SQL migration and live policy verification before uploading
the dependent website files. See [MEMORY-LANE.md](MEMORY-LANE.md).

## Preview and deploy

```sh
npm run deploy:plan
```

This checks the authenticated site's name and compares local SHA-1 hashes with
Neocities' file list. It prints the files that differ without uploading anything.
It requires network access and a valid key. There is no local deployment history
to lose: a new checkout compares against the actual remote copies.

After reviewing changes, running required tests, committing and pushing:

```sh
npm run deploy
```

Deployment requires a clean working tree and HEAD matching the tracked upstream
commit. It runs the full regression suite again before uploading, then submits
changed files in one request and verifies remote hashes. No files are uploaded if
tests fail. The first deployment may include more files than the latest commit
because all approved website files are compared with the live site.

An API or verification failure is reported as a failure, not a successful deploy.
If a request was interrupted, run a fresh plan to determine what actually reached
the site before retrying. There is no automatic retry or rollback, and a batch
upload is not a guaranteed atomic site release. Inspect the public site after
uploading; matching storage hashes do not verify CDN cache or live Supabase behavior.

Only the ten HTML pages, seven CSS files, eighteen JavaScript files and two bundled
vendor files are eligible. New website assets must be deliberately added to the
manifest. Tests, documentation, scripts, credentials and SQL are excluded.

For rollback, restore the desired website version in a new Git commit, test and
push it, then deploy again. Collection data in Supabase is unaffected.

API reference: <https://neocities.org/api>
