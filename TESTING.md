# NeoCache regression checks

Run the complete required check from the project folder:

```sh
npm run test:all
```

On a fresh checkout, install the pinned test dependency and browser engines once:

```sh
npm ci
npx playwright install chromium webkit
```

`npm test` runs only the 53 fast tests. `npm run test:browser` runs only the
browser suite. `npm run test:all` stops with an error if either suite fails.

Requires Node.js 22.6+. No credentials or live database are needed. The fast suite
has no dependencies; the browser suite uses the pinned Playwright dev dependency.
The test runner starts and stops its own local server on 127.0.0.1:4187. A busy
port is an error; it never reuses an unknown server.
Alternatively run `node scripts/regression.mjs` using its full filesystem path;
the runner sets the working directory automatically.

The command checks syntax of JavaScript and TypeScript files, then discovers and
runs every `tests/**/*.test.mjs` file. It exits with a nonzero code on failure.
Existing music and ISBN tests are included automatically.

## Coverage

- Full archive-script initialization against each collection's real HTML IDs
  and a simulated DOM, with synthetic paginated API responses.
- Isolation of Archive, Music, Books and Comics; exclusion of room gallery posts;
  merchandise stays in Archive.
- Format/artist filters, catalog-number/ISBN/issue search and empty results.
- The Hardback/Paperback precedence bug: options, filtering and rendered card.
- Primary-image ordering, image viewer navigation and close.
- Fallback when optional tables are missing, and explicit error when a required
  collection table is unavailable.
- Shared navigation, current-page marker, Database Link, Origin Signal markup
  and handlers, local asset existence, duplicate/missing IDs and asset versions.
- Artifact, music and publication saves; preservation of identifiers; partial
  upload rollback; detail write rollback; reference refresh failure after saving.
- Storage pagination, folder names, removal, errors and logout during a request.
- ISBN validation, edition mapping, explicit selection before filling a form,
  no matches, camera stop, admin authorization, lookup cache and throttling.

- Persistent visit-counter UI across all public pages, reload/session deduplication,
  new sessions, backend outages, blocked browser storage and admin exclusion.
  The counter RPC is mocked; database atomicity and grants need SQL review.

- Duplicate warnings: ISBN-10/13 equivalence, barcode padding, catalog/artist and
  release IDs, title hints, pagination, explicit override, fresh pre-save checks
  and failure without writes. Lookup tests now explicitly approve a known duplicate.

## What this does not prove

The fast suite uses a simulated DOM. The browser suite exercises the real local
website in Chromium desktop and WebKit with an iPhone 13 device profile. Both
suites mock backend services: neither executes SQL against Postgres, validates
deployed RLS, confirms third-party availability, compares rendered pixels, or
scans through a physical phone camera.

For layout/navigation changes, inspect desktop and mobile in a browser. For SQL
or deployment changes, verify the actual environment separately. Never insert
synthetic test data into production without an explicitly approved workflow.

## Adding a regression

Add a `.test.mjs` file under tests or extend an existing behavior test. The runner
discovers it automatically. Prefer exercising actual handlers/functions with
synthetic input. Use `tests/helpers/archive.mjs` to run the complete archive page
script; its DOM is deliberately minimal and throws on missing HTML IDs.

The root AGENTS.md requires the full check before future implementation work is
reported as complete. A passing result reduces regression risk; it is not a
guarantee that every possible failure is covered.

## Browser regression suite

`tests/browser/*.spec.mjs` contains 14 user journeys, each run in both browser
projects (28 browser runs). Tests click the real UI and wait for observable
results instead of fixed sleep delays. There are no automatic retries masking
intermittent failures.

Coverage includes all five collections, real navigation, current-page markers,
Origin Signal on collections and Rooms, mobile overflow, format/artist/ISBN/
catalog search, reset, photo navigation, item deep links, admin login/logout,
record-kind switching, folder refresh, explicit ISBN selection, edition lookup,
manual comics without ISBN, save requests and cleanup after a failed save.

`tests/browser/fixtures.mjs` replaces config.js with a fake endpoint before it
executes. The browser intercepts API and image requests with synthetic responses;
all non-local traffic other than the intercepted fixture host is blocked and
causes test failure. Unexpected fixture endpoints and uncaught page errors also
fail the test. Mock writes are recorded in memory for assertions, never sent to
Supabase. Service workers are blocked.

Each failure retains a screenshot and Playwright trace in `.test-results/`.
The HTML report is in `.playwright-report/`. Open it with:

```sh
npm run test:report
```

Neither report folder, node_modules, test files, package files nor Playwright
configuration belongs on Neocities. No production website files were changed
when installing this test layer.

## Verify the tests catch historical bugs

```sh
npm run test:guards
```

This starts isolated desktop runs with two deliberate regressions injected only
into intercepted browser responses: stale Paperback overriding Hardback, and a
missing Comics navigation link. It requires exactly the expected assertion
failure for each regression; startup errors or an unrelated failure do not count
as success. Application files are never edited. Run `npm run test:all` afterwards
to leave a fresh passing HTML report. The guard check is required when changing
the browser harness and optional on routine application changes.
