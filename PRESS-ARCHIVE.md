# Press Archive

A standalone Duran Duran press collection at `press.html`, linked from each public
page's footer. Original headlines stay in their original language. Readers can
combine year, language and article-type filters with text search, then open a
shareable article and browse its scanned pages in a zoomable viewer.

## Database before website deployment

**Database status, 2026-10-09:** migration from commit `87ae74f` applied and both
live SQL verification scripts passed. See [SUPABASE-CHANGELOG.md](SUPABASE-CHANGELOG.md).
Do not rerun it in NeoCache; the steps below document setup for an installation
without it.

1. Follow [SUPABASE-OPERATIONS.md](SUPABASE-OPERATIONS.md) for project
   `zdozxuxouuwmpkajoign`. The single-administrator guard must already exist.
2. Review and run [supabase-press-archive-20261009.sql](supabase-press-archive-20261009.sql)
   once. It adds `press_articles`, `press_pages` and the private `press` bucket.
   Existing collection records and buckets are unchanged.
3. Run [tests/sql/press-archive-regression.sql](tests/sql/press-archive-regression.sql)
   and [tests/sql/security-regression.sql](tests/sql/security-regression.sql).
   Record verified execution in [SUPABASE-CHANGELOG.md](SUPABASE-CHANGELOG.md).
4. Deploy the website only after verification. No new secret or Edge Function.

The migration is transactional and fails if its objects already exist. Inspect
an uncertain execution before retrying. Recovery is to unpublish articles and
revert frontend changes in a new commit, retaining tables and scans.

## Register an article

1. Sign in at `admin.html` and find **Press Archive** below Tag maintenance.
2. Choose **NEW ARTICLE**. Enter the original headline and language, then select
   Interview, Review, News, Feature, Advertisement or Other.
3. Optionally enter the newspaper/magazine, year, exact date, description (for
   example a Danish summary) and personal notes. An exact date determines the
   year. Leave dates blank if unknown; no invented publication date is needed.
4. Leave **Published in Press Archive** unchecked and **SAVE ARTICLE** as a draft.
5. Add scans individually with **ADD SCAN**, optionally captioning each page.
   JPEG, PNG and WebP up to 20 MB each are supported at their uploaded resolution.
   PDF upload and OCR/automatic translation are not included.
6. Use **SAVE CAPTION / ORDER** per scan to arrange pages. Lowest order comes
   first and supplies the cover; equal values use upload time, then ID.
7. Check **Published in Press Archive** and save. The public link opens the
   article; visitors can choose a page, zoom, scroll, and move between pages.
   Uncheck and save to return to a private draft.

All article text, including personal notes, is public when published. Text is
rendered as plain text, preserving paragraphs. Search covers the headline,
publication, description and notes. It does not search text inside scans.
**NEW ARTICLE** and **REFRESH ARTICLES** discard unsaved form edits.

## Storage and privacy

Anonymous readers can only read published articles and their linked pages.
Scans use authenticated Storage requests with public client credentials and
RLS, then temporary browser blob URLs. The bucket is private, with a restrictive
read boundary protecting drafts even from unrelated permissive Storage policies.
Only the configured administrator can create or edit articles and scans.
Unpublishing prevents new reads, but cannot revoke already downloaded copies.

Upload and page registration are separate operations. If the registration fails
or its outcome is uncertain, the uploaded file stays private in Storage. Refresh
before retrying. Unlinked files can be reviewed in Storage separately. The editor
does not delete articles or original files.

## Website files and tests

New: `press.html`, `press.css`, `press-core.js`, `press.js`, `admin-press.js`.
Changed: `admin.html`, `index.html`, `music.html`, `books.html`, `comics.html`,
`rooms.html`, `about.html`, `tour.html`, `memories.html`.
Use `npm run deploy:plan` then `npm run deploy`. SQL, tests, scripts and guides
must not be uploaded to Neocities.

`npm run test:all` covers filters, pagination, ordering, drafts, publish/unpublish,
plain-text rendering, viewer navigation/zoom, failures/retries, uploads and admin
editing on desktop Chromium and mobile WebKit. All fixtures are synthetic and
services mocked; live SQL verification remains a separate step.
