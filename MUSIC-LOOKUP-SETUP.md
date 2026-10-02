# Activate barcode lookup

The implementation is in `admin.html`, `music-lookup.js` and
`supabase/functions/music-lookup/`. It uses the existing admin session and
MusicBrainz release search. No MusicBrainz API key is required.

## Supabase

1. Apply `supabase-music-setup.sql` if it has not been applied yet.
2. Run `supabase-music-lookup-setup.sql` in the project's SQL Editor.
3. Create an Edge Function named `music-lookup` containing both `index.ts`
   and `core.mjs` from `supabase/functions/music-lookup/`.
4. Set the Edge Function secret `MUSICBRAINZ_CONTACT` to your contact email
   or website URL. This identifies NeoCache to MusicBrainz.
5. Deploy the function with JWT verification enabled (the default).
   It additionally verifies the user and calls `is_neocache_admin()`.
   Supabase supplies the URL, anon key and service role key automatically;
   never put the service role key in the website.

Alternatively, with an authenticated Supabase CLI from this directory:

```sh
supabase secrets set MUSICBRAINZ_CONTACT='YOUR_CONTACT_EMAIL_OR_WEBSITE' --project-ref zdozxuxouuwmpkajoign
supabase functions deploy music-lookup --project-ref zdozxuxouuwmpkajoign
```

Upload the changed website files, including `music-lookup.js` and the `vendor`
folder, to the existing HTTPS website. The scanner library is loaded only when
Scan barcode is clicked. Its license is included in `vendor/ZXING-LICENSE`.

## Phone check

- Sign in to admin and select Music release.
- Choose Scan barcode, allow camera access, and scan an EAN/UPC barcode.
- Compare results and choose Use this release; nothing is saved automatically.
- Confirm title, artist, format, year, country and catalog number, then add
  photos and condition and save. Check the Music page after saving.
- Also try catalog-number search, a barcode with no matches, denied camera
  permission, and Stop camera. The camera also stops when leaving the tab,
  logging out, resetting the form or switching record kind.

The lookup shows up to 25 matches; narrow broad artist/title searches as needed.
Responses are cached for 24 hours. A database-backed throttle allows one uncached
MusicBrainz request per 1.1 seconds across function instances. Temporary upstream
failures do not change the form. Album identification may require comparing
multiple editions, and fields absent from MusicBrainz can be entered manually.

## Validation

```sh
node --experimental-strip-types --test tests/music-lookup.test.mjs
node --check music-lookup.js
```

The backend tests cover query escaping, identifier preservation, field mapping,
admin checks, cache hits, throttling and upstream results. An actual MusicBrainz
barcode search was verified during implementation. Deployment and a physical
phone camera test remain necessary.
