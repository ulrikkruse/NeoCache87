# Books og Comics — aktivering

Koden er gemt lokalt. Der er endnu ikke ændret noget i din Supabase-database
eller på Neocities. Den eksisterende musikfunktion behøver ikke ændres.

## 1. Supabase: SQL Editor

Åbn `supabase-publications-setup.sql`, kopiér hele indholdet til en ny query,
og tryk Run. Den opretter bog-/tegneseriedetaljer og cache til ISBN-opslag.
Den forudsætter, at den eksisterende adminopsætning er kørt.

Books og Comics bruger samme `publication_details`-tabel med et `kind`-felt,
men vises på separate sider. Billeder og tags genbruges fra det eksisterende arkiv.
ISBN er valgfrit, så hæfter uden ISBN kan registreres. Dubletter af samme udgave
kan gemmes som separate eksemplarer med egne fotos og stand.

## 2. Supabase: Edge Functions

Opret en funktion med navnet **publication-lookup** (uden filendelse).
Den skal indeholde præcis disse to filer fra mappen
`supabase/functions/publication-lookup/`:

- `index.ts`
- `core.mjs`

Indsæt filernes indhold og deploy med JWT-verificering slået til.
Der skal ikke oprettes nogen ny secret eller Open Library-konto.
Koden bruger det eksisterende adminlogin og Supabases standardnøgler.
Navnet `publication-lookup` er funktionens navn, ikke en tredje fil.

## 3. Neocities: upload

Upload/overskriv disse filer i hjemmesidens rod:

- `index.html`
- `music.html`
- `books.html` (ny)
- `comics.html` (ny)
- `rooms.html`
- `about.html`
- `admin.html`
- `style.css`
- `admin.css`
- `app.js`
- `admin.js`
- `isbn.js` (ny)
- `publication-lookup.js` (ny)

Behold `music-lookup.js`, `config.js`, `rooms.js`, `rooms.css`, `about.css`
og mappen `vendor` på siden. Hvis du endnu ikke har uploadet den tidligere
Rooms-rettelse, skal `rooms.js` også uploades.

SQL-filer, `supabase`-mappen, tests og denne vejledning skal ikke til Neocities.

## 4. Prøv funktionen

1. Åbn admin på telefonen og vælg Record kind → Book eller Comic.
2. Scan ISBN eller søg på titel, forfatter eller serie og nummer.
3. Sammenlign resultaterne med dit eksemplar og vælg Use this edition.
4. Kontrollér format, udgave, sprog og eventuelle serie-/nummeroplysninger.
   Felter, der ikke findes hos Open Library, udfyldes manuelt.
5. Tilføj egne billeder og stand. Vælg en Storage-mappe, fx books eller comics,
   og lad Room gallery stå på Collection. Gem.
6. Kontrollér posten på Books eller Comics og åbn billedgalleriet.

ISBN-10 og ISBN-13 med kontrolciffer understøttes. Scanning afviser musikstregkoder
og almindelige comic-UPC'er. Hæfter uden ISBN kan indtastes manuelt.
Titelsøgning viser op til 12 foreslåede udgaver, ikke alle tryk af hvert værk.
Den valgte udgave hentes separat før felterne indsættes. Egne fotos og stand
ændres ikke af opslaget. Kameraet stopper ved Stop, logout eller faneskift.

## Kontrol udført

- 18 automatiske tests for musik, publikationer, ISBN, adgangskontrol og formularer.
- Rigtige Open Library-opslag på ISBN og tegneserietitel.
- Books kontrolleret i desktopbrowser og Comics ved 390 px mobilbredde.
- Supabase-migration, deployment og fysisk telefonscanning mangler stadig.

Tests: `node --experimental-strip-types --test tests/*.test.mjs`
