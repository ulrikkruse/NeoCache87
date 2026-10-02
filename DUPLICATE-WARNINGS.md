# Duplicate warnings

Upload admin.html, admin.css, admin.js, duplicates.js, music-lookup.js and
publication-lookup.js to Neocities. No new SQL or Edge Function deployment.

Admin checks when fields change, when an ISBN/barcode lookup starts (including
scanned codes), when a lookup result is applied and again before any upload.
A warning links to existing dossiers and lists the matching identifiers.
Check the confirmation box to intentionally save an additional copy, then use
COMMIT TO ARCHIVE. Editing the form invalidates that confirmation.

ISBN-10 and its equivalent ISBN-13 match across Books and Comics. Music matches
barcodes (UPC/EAN padding included), MusicBrainz/Discogs release IDs or artist
plus catalog number. A same-title match within a collection is only a hint:
it may be another edition/model. Room gallery records are excluded.

The check reads all pages of records visible to the signed-in administrator.
An unavailable check stops saving, preserves the form and can be retried.
No database uniqueness constraint is introduced: simultaneous users can still
create duplicates, and records without matching identifiers/titles cannot be
detected. This is a warning system, not a guarantee of uniqueness.

Tests use mocked services. Physical camera scanning was not tested; the scanner
itself is unchanged and the lookup path accepts manual or camera-filled codes.
