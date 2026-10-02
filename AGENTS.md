# NeoCache project instructions

## Keep documentation current

Update README.md as part of any change that affects its description of features,
setup, usage, tests, deployment or project structure. Update linked guides when
their instructions change. Include relevant documentation in the same commit
as the implementation; do not require a separate user reminder. Internal changes
that do not affect the documentation do not need a README edit.

## Mandatory regression check

For every change to application code, HTML, CSS, database SQL, dependencies or
Supabase functions, run `npm run test:all` from this project before reporting completion
or preparing an upload. This is the user's explicit requirement. Documentation-only
changes do not require rerunning the suite unless test instructions changed.

- Fix failures before declaring the work complete. Do not skip, delete or weaken
  tests to obtain a passing run. If intended behavior changes, update its tests
  and explain that change.
- Add a regression case when fixing a reproducible bug. Cover behavior rather
  than copying the implementation into a test.
- New functionality must retain coverage for Archive, Music, Books, Comics,
  Rooms and admin. Keep fixtures synthetic and tests offline; never write test
  records into the live Supabase project.
- Report the test result in the final response. If unable to run it, explicitly
  state the blocker and do not describe the change as verified.
- `npm run test:all` runs the fast offline suite and real browser tests in Chromium
  desktop and WebKit mobile. Services remain mocked. For HTML/CSS changes, also
  inspect the affected layout visually; functional tests are not pixel comparisons.
  For camera changes, identify whether a real phone test was done.
- If the sandbox prevents the local server or browser from starting, request
  escalation and rerun the same command; do not omit browser tests.
- When changing the browser harness, run `npm run test:guards` to verify that
  historical format/navigation regressions still fail the browser tests.
- SQL changes additionally need review of constraints, RLS and rollback behavior.
  Passing these tests does not prove SQL has been executed or deployed.
- Keep cache-version references synchronized across pages that share assets.
- In delivery notes, list the files the user needs to upload to Neocities;
  distinguish website files from SQL/Edge Function setup. Do not upload tests,
  scripts, package.json or these instructions to Neocities.

See TESTING.md for coverage and commands.

## Git commits and pushes

The user-selected GitHub repository is https://github.com/ulrikkruse/NeoCache87.
Before the first push, inspect its existing history and default branch; preserve
any existing remote commits when connecting this workspace.

The user authorizes committing and pushing completed NeoCache changes after the
required checks pass. Apply this workflow to future changes without asking for
routine confirmation again.

- Review the diff and commit only changes belonging to the completed task. Do
  not include unrelated user edits, secrets, dependencies or generated reports.
- For application changes, run the required regression checks before committing.
  Documentation-only changes retain the exception above.
- Create a descriptive commit and push to the configured project remote and
  intended branch. Inspect the remote and branch first; do not guess a repository.
- Do not force-push, rewrite history or overwrite remote work. Report missing
  repository configuration, authentication failures or conflicts as blockers.
- Report the commit identifier and whether push succeeded. A local commit is
  not a successful push. Git pushes do not imply deployment to Neocities or
  execution of Supabase migrations.

## Neocities deployment

The user authorizes uploading completed website changes to neocache87 after the
required checks, commit and push. Use `npm run deploy:plan` to inspect differences,
then `npm run deploy`; it reruns the tests and verifies uploaded hashes. Follow
NEOCITIES-DEPLOY.md. Do not deploy uncommitted changes or bypass a failed check.
The API key is in ignored `.env.neocities` or the environment. Never print it or
include it in Git, website uploads or chat. If absent, finish local setup and
report deployment blocked pending local key entry. Report actual upload status
separately from Git push status. SQL and Edge Functions remain separate.

## Supabase SQL operations

The user authorizes executing routine SQL schema changes and fixes required for
requested NeoCache work in project `zdozxuxouuwmpkajoign`. Follow
SUPABASE-OPERATIONS.md using the signed-in browser SQL Editor when available.
Ask before deleting existing data or making materially risky changes. Prepare
and version the exact SQL first, verify the live result, and record execution in
SUPABASE-CHANGELOG.md. Do not rerun historical setup scripts blindly or report
SQL as deployed based only on passing mocked tests. No new private credentials
are required for the browser workflow; never extract browser session secrets.
