# Memory Lane

Memory Lane is a standalone page for personal stories and photo albums, linked
from the footer of every public page. Its visitor counter shares the existing
session count. No sample memories are installed in the live database.

## Database setup before website deployment

**Database status, 2026-10-04:** the migration from commit `43d5f61` has been
executed in NeoCache and both live SQL verification scripts passed. See
[SUPABASE-CHANGELOG.md](SUPABASE-CHANGELOG.md). Do not rerun this migration in
that project. The steps below document setup for an installation without it.

1. In project `zdozxuxouuwmpkajoign`, review and run
   [supabase-memory-lane-20261004.sql](supabase-memory-lane-20261004.sql) once,
   following [SUPABASE-OPERATIONS.md](SUPABASE-OPERATIONS.md). The existing `items`
   table and single-administrator guard must already exist.
2. Run [tests/sql/memory-lane-regression.sql](tests/sql/memory-lane-regression.sql)
   and [tests/sql/security-regression.sql](tests/sql/security-regression.sql).
   Record the verified execution in [SUPABASE-CHANGELOG.md](SUPABASE-CHANGELOG.md).
3. Only then deploy the website. No Edge Function or new secret is required.

The migration adds `memories`, `memory_photos` and a **private** `memories` Storage
bucket. It does not modify collection records or the public `images` bucket.
It runs transactionally and fails if these objects already exist; inspect any
uncertain execution before retrying. Recovery is to unpublish memories and revert
the frontend in a new commit, retaining tables and files to avoid data loss.

## Add a memory

1. Sign in at `admin.html` and find **Memory Lane** below Tag maintenance.
2. Choose **NEW MEMORY**. Enter a title and story; optionally supply a year or
   approximate period, place, theme and a linked collection object.
3. Leave **Published in Memory Lane** unchecked and choose **SAVE MEMORY**.
4. Add photographs one at a time, with optional captions. JPEG, PNG and WebP are
   supported, up to 20 MB each. Images are stored at their uploaded resolution.
5. Edit captions and order with each photograph's **SAVE CAPTION / ORDER** button.
   The lowest order number supplies the cover; equal numbers use upload order.
6. Check **Published in Memory Lane** and save when ready. **OPEN PUBLISHED
   MEMORY** opens the shareable reading page. Uncheck and save to return to draft.

Saved memories can be selected and edited later. **NEW MEMORY** and **REFRESH
MEMORIES** clear unsaved form edits. Story text preserves paragraph breaks and
is rendered as plain text, so HTML is never executed.

The reading page presents the story and its full album. An optional dossier link
opens the correct collection. Every collection dossier has **RELATED MEMORIES**,
which shows published stories linked to that object, or an explicit empty state.

## Photo access and failed saves

Visitors can read only published stories and their linked photo records. Photo
downloads include the public client credentials and apply Storage RLS; the site
uses temporary browser blob URLs, not public bucket URLs. An additional
restrictive policy isolates this bucket from legacy permissive Storage readers.
The administrator can read drafts and uploaded files. Unpublishing prevents new
reads; it cannot erase photographs visitors have already downloaded or displayed.

Storage upload and photo registration are separate operations. If registration
fails or its result is uncertain, the admin UI keeps the file and reports the
failure. Refresh before retrying; an unlinked upload is not publicly readable.
Unused files can be reviewed separately in Supabase Storage. This initial editor
does not delete memories or original photographs.

## Files and checks

New website files: `memories.html`, `memories.css`, `memory-core.js`, `memories.js`,
`admin-memory.js`. Also upload the changed `admin.html`, `app.js`, `index.html`,
`music.html`, `books.html`, `comics.html`, `rooms.html`, `about.html`, `tour.html`.
Use the deployment manifest; SQL, guides and tests do not belong on Neocities.

Run `npm run test:all`. Browser tests cover drafts, publication, albums, captions,
linked dossiers, errors/retries, upload validation, logout and mobile layout,
using synthetic data only. These mocks do not verify live RLS; SQL verification
is a separate required deployment step.
