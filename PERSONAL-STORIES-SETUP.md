# Personal stories (ARCHIVE only)

Run `supabase-personal-stories-setup.sql` in Supabase SQL Editor before uploading.
Upload app.js, admin.js, style.css, admin.css and index.html, music.html, books.html,
comics.html, rooms.html, about.html and admin.html to Neocities. HTML versions
are updated together because the stylesheet and collection script are shared.
Do not upload SQL, tests or this guide. No Edge Function changes are needed.

For new artifacts, enter PERSONAL STORY in the admin form. For existing items,
choose the item in the maintenance section and click SAVE PERSONAL STORY.
Clear the field and save to remove a story. Stories are public plain text with
paragraph breaks preserved, shown when opening an ARCHIVE item's details.
Empty stories create no section. Other collections never display the section.

The migration only adds a nullable text column: existing records are unchanged.
Existing items RLS governs reads and edits; no policies or grants are widened.
Updates change only this column. Failed writes retain the entered text for retry.
New-record saves retain the existing rollback workflow. Browser tests use mocked
services and do not verify that this migration has been applied to production.
