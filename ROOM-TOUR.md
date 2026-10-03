# Room Tour

`tour.html` is a separate interactive tour, reached through **EXPLORE THE ROOM**
on The Rooms. It uses separate high-resolution photographs; existing gallery
records remain unchanged. Visitors choose a view, zoom from 100% to 400%, scroll
or swipe around the image (mouse dragging is also supported), toggle markers,
and open linked collection dossiers from the object panel. The numbered object
list provides a keyboard-accessible alternative to the markers.

## Add your first view

1. Sign in to admin and scroll to **Room Tour**.
2. Enter a title and upload a JPEG, PNG or WebP (at most 20 MB / 50 megapixels).
   The original is retained and a JPEG preview up to 1400 pixels wide is generated
   automatically. Uploads go to the existing `images` bucket under `room-tour/`.
3. The new view starts unpublished. Click a position on its preview, search for a
   collection object, select it and choose **SAVE MARKER**. X/Y percentage fields
   also allow keyboard placement and precise adjustment. Selecting an existing
   object's marker and saving moves it rather than adding a duplicate.
4. Check **Published in Room Tour** and save the view settings. Open the public
   tour to inspect it. Repeat for additional photographs or camera angles.

**REMOVE** removes only a marker, never its collection object. Unchecking
Published hides a view and its markers through RLS. Images are in the existing
public Storage bucket: unpublished is a publishing control, not private storage.
Do not upload private photographs. There is no image replacement or scene deletion
button in this version. Upload a new view and unpublish the old view when needed.

The public page loads the preview first. Original images are requested only on
zoom-in or **LOAD HIGH RESOLUTION**. A failed original load preserves the preview.
Switching views cannot apply an in-flight original to the wrong scene. Positions
are stored against the full image, not a cropped version.

## Database and deployment

Apply `supabase-room-tour-20261003.sql` once after reviewing the target project.
It adds `room_tour_scenes` and `room_tour_points` in one transaction and does not
change existing tables, data, policies or Storage permissions. Scene titles and
paths are constrained; marker coordinates are bounded to 0–100 and each scene
can link each object once. Foreign keys remove dangling markers if their scene
or collection item is subsequently deleted. Only the existing administrator may
write. Public users can read published scenes and their markers only.

Run `tests/sql/room-tour-regression.sql` and the existing security regression SQL
after migration. They read metadata without inserting production test data.
Review `SUPABASE-CHANGELOG.md` for actual deployment status. Recovery is to
unpublish views or restore the previous website in a new commit; keep tables and
photographs rather than destructively dropping stored work.

Deploy the five new assets (`tour.html`, `tour.css`, `tour-core.js`, `tour.js`,
`admin-tour.js`) plus changed `rooms.html`, `admin.html` and `admin.js` using the
normal Neocities workflow after the SQL is verified. No Edge Function is needed.
Admin upload failures retain inputs and may leave unused files in Storage. They
are not automatically deleted because an ambiguous response may have saved a
reference. Inspect the view list and Storage before retrying or removing files.

Browser tests use synthetic photos and API responses, cover marker editing,
publication, upload, failure recovery, lazy originals, navigation and mobile
layout. They do not test a physical phone or perform production writes.
