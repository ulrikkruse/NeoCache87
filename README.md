# NeoCache87

A personal collection archive for retro technology, music, books and comics — featuring barcode scanning, personal stories and an ’80s-inspired neon aesthetic.

[Visit NeoCache87](https://neocache87.neocities.org/)

NeoCache87 combines a public collection website with an authenticated admin interface. The website runs on Neocities, while Supabase stores collection data and images and handles administrator authentication.

## Explore the collection

| Page | Contents |
| --- | --- |
| Archive | Retro computers, consoles, games, merchandise and other artifacts |
| Music | Physical music releases, including vinyl, CDs and cassettes |
| Books | Books with edition details and optional ISBNs |
| Comics | Comics with series, issue and edition details |
| The Rooms | Photo galleries of the ’80s room and home cinema |
| Room Tour | Zoomable photographs with markers linking to collection dossiers |
| Memory Lane | Personal memories, places and photo albums from the eighties |
| Origin File | The personal story behind NeoCache87 |

## Features

- Write personal memories in [Memory Lane](MEMORY-LANE.md), with photo albums,
  captions, private drafts, publication and links to collection dossiers.

- Explore the [Room Tour](ROOM-TOUR.md), with high-resolution views, clickable
  objects and an admin editor for uploading photographs and placing markers.

- Search and filter collections, open item dossiers, browse image galleries and share links to individual items.
- Register items through admin with photos, tags, condition and location.
- Look up music through MusicBrainz using a barcode, catalog number or text search.
- Look up books and comics through Open Library using ISBN or text search.
- Scan supported barcodes with a phone camera. Manual entry remains available.
- Warn about possible duplicates and allow intentional additional copies.
- Add personal stories to new or existing Archive items, displayed inside **OPEN DOSSIER**.
- Show a persistent visit count stored in Supabase, preserved across website uploads. It counts browser tab sessions, not unique people.

## How it works

The public website uses HTML, CSS and browser JavaScript, with no frontend build step. It reads collection data through Supabase REST and images through Supabase Storage. Authenticated admin requests are subject to database access rules.

Two Supabase Edge Functions handle external lookups: `music-lookup` and `publication-lookup`. Camera scanning uses the bundled ZXing browser library; its license is included in [vendor/ZXING-LICENSE](vendor/ZXING-LICENSE).

## Run locally

Use Node.js 22.6 or later. From the project directory:

```sh
npm ci
node scripts/test-server.mjs
```

Open [http://127.0.0.1:4187/](http://127.0.0.1:4187/). The admin interface is at `/admin.html`. Stop the server with Ctrl+C before running browser tests, which use the same port.

**A normal local preview uses the Supabase project configured in `config.js`. Admin changes made there affect that database.** Automated tests substitute synthetic data and do not write to production.

Camera access requires HTTPS or a browser-supported localhost context. A phone opening an ordinary HTTP address on another computer may not permit camera access.

## Tests

Install the browser engines once:

```sh
npx playwright install chromium webkit
```

Run the required regression checks before committing application changes:

```sh
npm run test:all
```

The suite covers collection pages and admin workflows with offline tests plus Chromium desktop and WebKit mobile browser tests. Backend services are mocked. Browser tests do not prove that live database policies are correct or that a physical phone camera works.

```sh
npm run test:report  # Open the latest browser test report
npm run test:guards  # Verify that historical regressions are detected
```

See [TESTING.md](TESTING.md) for coverage and [AGENTS.md](AGENTS.md) for project workflow requirements. Live database security checks are separate: run [tests/sql/security-regression.sql](tests/sql/security-regression.sql) in Supabase SQL Editor after relevant policy changes.

## Supabase setup

For ongoing database changes, see [SUPABASE-OPERATIONS.md](SUPABASE-OPERATIONS.md)
and the [execution log](SUPABASE-CHANGELOG.md). SQL can be executed through the
owner's signed-in dashboard session; this is separate from Neocities uploads.

This repository contains incremental setup scripts for the existing NeoCache database. It is **not a complete one-command database bootstrap**: a new installation needs the base `items`, `images`, `tags` and `item_tags` tables, their relationships and public read policies, plus the `images` Storage bucket.

For another installation, configure your own project URL and public client key in `config.js`, create an administrator and set that user's UUID in `supabase-admin-setup.sql` before running it. Review each setup guide and its prerequisites:

| Setup | Guide or script |
| --- | --- |
| Memory Lane | [MEMORY-LANE.md](MEMORY-LANE.md) |
| Administrator access | [supabase-admin-setup.sql](supabase-admin-setup.sql) |
| Music releases and lookup | [MUSIC-LOOKUP-SETUP.md](MUSIC-LOOKUP-SETUP.md) |
| Books, comics and ISBN lookup | [BOOKS-COMICS-SETUP.md](BOOKS-COMICS-SETUP.md) |
| Persistent visit counter | [VISITOR-COUNTER-SETUP.md](VISITOR-COUNTER-SETUP.md) |
| Archive personal stories | [PERSONAL-STORIES-SETUP.md](PERSONAL-STORIES-SETUP.md) |
| Duplicate warnings | [DUPLICATE-WARNINGS.md](DUPLICATE-WARNINGS.md) |
| Access hardening and verification | [SECURITY-SETUP.md](SECURITY-SETUP.md) |

Some feature guides describe their original rollout; those notes are not a live deployment-status report. Run the security-hardening script after the original setup scripts and verify the resulting policies. Disable public user signups for this single-administrator application.

The Supabase URL and `anon` client key in `config.js` are public browser configuration. Access must be enforced through database grants and Row Level Security (RLS). Private keys, database passwords and administrator credentials must never be committed or uploaded with the website. Edge Function secrets belong in Supabase.

## Deploy to Neocities

Automatic uploads are available with `npm run deploy:plan` and `npm run deploy`.
See [NEOCITIES-DEPLOY.md](NEOCITIES-DEPLOY.md) for local API-key setup, checks and
verification. Only changed website files are uploaded; Supabase is separate.

There is no build output to generate. Upload the website files from the project root:

- HTML: `index.html`, `music.html`, `books.html`, `comics.html`, `rooms.html`, `about.html`, `admin.html`, `tour.html`, `memories.html`.
- CSS: `style.css`, `rooms.css`, `about.css`, `admin.css`, `tour.css`, `memories.css`.
- JavaScript: `config.js`, `app.js`, `rooms.js`, `admin.js`, `isbn.js`, `music-lookup.js`, `publication-lookup.js`, `visitor-counter.js`, `duplicates.js`, `tour-core.js`, `tour.js`, `admin-tour.js`, `memory-core.js`, `memories.js`, `admin-memory.js`.
- The `vendor/` directory, preserving its paths and license.

Upload related HTML and asset changes together so cache-version references stay synchronized. Supabase SQL scripts and Edge Functions are applied separately through Supabase.

Do not upload tests, scripts, database SQL, documentation, package files, `node_modules/`, test reports or `.git/` to Neocities.

## Version control

Completed changes are committed and pushed after the required checks pass. GitHub stores website code, tests and setup instructions; pushing a commit does not deploy the website or apply database migrations.

Collection records and uploaded photos live in Supabase and need their own backup strategy. They are not backed up by committing this repository.
