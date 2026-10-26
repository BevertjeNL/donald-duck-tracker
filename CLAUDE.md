# CLAUDE.md

Spiekbriefje voor toekomstige AI-sessies op deze repo. Beschrijft de bouw
zoals die nu is (versie 2.2.0).

## Wat dit is

Donald Duck Tracker: een Progressive Web App (persoonlijke naslag) om bij te
houden welke nummers van Donald Duck Weekblad, Katrien Duck Weekblad en
Pockets je al gelezen hebt.

**Single-page vanilla HTML/CSS/JS. Geen build-stap, geen framework, geen
bundler, geen `package.json`, geen dependencies.** De bestanden worden
ongewijzigd door Vercel geserveerd. Stel geen build-tool, framework of
bundler voor.

## Architectuur

```
Browser (index.html + app.js)  --fetch-->  /api/magazines  --HTTPS-->  Neon Postgres
        PWA + service worker              Vercel-functie           tabel `magazines`
```

- **Live:** https://donald-duck-tracker.vercel.app/
- **Repo:** github.com/BevertjeNL/donald-duck-tracker, productie = `main`
- **Vercel:** team `bevertje`, project `donald-duck-tracker`. Elke push naar
  `main` deployt automatisch naar productie, andere branches krijgen een
  preview-URL. Vercel-inlogbeveiliging (SSO) staat bewust uit, anders krijgt
  de PWA een Vercel-loginscherm.
- **Neon:** project `donald-duck-tracker` (regio eu-central-1, database
  `neondb`). Connection string staat als gevoelige variabele `DATABASE_URL`
  in Vercel (production en preview). Nooit in de repo of in chat zetten.
- **Geen auth, geen inlogscherm.** Iedereen met de URL kan lezen en schrijven.
  Dat is een bewuste keuze voor een naslag-app. De backup-knop is het
  vangnet.
- **Oude GitHub Pages-URL** (`bevertjenl.github.io/donald-duck-tracker/`)
  stuurt via een script bovenin `index.html` door naar Vercel.
- **Supabase is niet meer in gebruik.** Raak nooit Reisplanner-tabellen of
  andere projecten in Supabase of Neon aan, alleen het Neon-project
  `donald-duck-tracker`.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | Alle markup. Eén pagina met `.view`-secties (home, yeargrid, pockets, quickcheck). Knoppen voor Backup en Snel opzoeken staan op meerdere plekken en gebruiken `data-do="backup"` en `data-do="quickcheck"` die met JS worden getoond of verborgen, geen router. Laadscherm `#authScreen`, app `#appScreen`. |
| `app.js` | Alle logica in één bestand, geen modules. |
| `style.css` | Alle styling. Donker navy/goud thema, kleuren als CSS-variabelen in `:root`. Schermvullend voor iOS: topbalk, `main` en laadscherm gebruiken `env(safe-area-inset-*)`, hoogte via `100dvh`. |
| `api/magazines.js` | Vercel-functie (CommonJS). Praat met Neon via de SQL-over-HTTP-endpoint (`https://<host>/sql`) met alleen `fetch`. |
| `schema.sql` | Tabel `magazines`, check-constraint en twee unieke indexen. Eenmalig draaien in Neon. |
| `sw.js` | Service worker. Cachet de app-shell, nooit `/api/`. |
| `manifest.json` | PWA-manifest (relatieve paden, `standalone`). |
| `icons/` | `icon-192.png`, `icon-512.png`, `icon-1024.png`, `apple-touch-icon.png`. Bronontwerp zit niet in de repo. |
| `.gitignore` | `.DS_Store`, `.vercel`. |

## Datamodel

Tabel `magazines` (zie `schema.sql`):

| Kolom | Betekenis |
|---|---|
| `id` | uuid, primary key |
| `type` | `dd_weekblad`, `kd_weekblad`, `pocket`, `dubbel_pocket` |
| `year` | jaar (1901 t/m 9999) voor weekbladen, `null` voor pockets |
| `number` | week 1 t/m 52 (DD), maand 1 t/m 12 (KD), pocketnummer, of `null` bij een speciale editie |
| `label` | titel/thema, verplicht bij speciale edities |
| `is_special` | speciale editie in een jaargang |
| `gelezen`, `gelezen_op` | status en moment |
| `created_at` | aanmaakmoment |

Een rij bestaat alleen als je iets hebt aangeraakt. Geen rij betekent
"niet gelezen". Uniek per `(type, year, number)` voor gewone weekbladen en per
`(type, number)` voor pockets (fout `23505`, de API geeft dan 409).

## API (`/api/magazines`)

| Methode | Doel |
|---|---|
| `GET` | alle rijen, gesorteerd op jaar en nummer |
| `POST` | rij toevoegen (velden: type, year, number, label, is_special, gelezen, gelezen_op) |
| `PATCH ?id=` | wijzig `gelezen`, `gelezen_op`, `number`, `label` |
| `DELETE ?id=` | rij verwijderen |

Velden gaan via een whitelist en worden als genummerde parameters
doorgegeven, dus geen string-concatenatie met gebruikersinvoer. Parameters
gaan als tekst naar Neon (`null` blijft `null`). Fouten komen terug als
`{ error, code }`.

## Opbouw van `app.js`

Volgorde in het bestand:

1. Constanten: `APP_VERSION`, `START_YEAR` (2017), `TYPE_LABELS`,
   `TYPE_MAX_NUMBER`, `TYPE_UNIT`.
2. Helpers: `api()` (fetch-wrapper), `showStatus`, `errorMessage`,
   `positiveInteger`, `withMutation` (voorkomt dubbele klikken), `showView`.
3. Extra jaren: opgeslagen in `localStorage` (`dd_tracker_extra_years_<type>`),
   alleen op dit apparaat.
4. Data: `refetchMagazines`, `toggleGelezen`, `insertRow`, `deleteRow`. De
   lijst staat in de globale `magazines`.
4b. Startscherm (`renderHome`): teller gelezen edities, laatst gelezen
   editie, voortgangsbalk per tijdschrift, kaarten Snel opzoeken en Backup.
   Wordt bij `showView('view-home')` en na elke refetch opnieuw getekend.
5. Jaaroverzicht (DD en KD): jaarchips plus heatmap-tegels. Gelezen is rood,
   ongelezen is gedimd. Tikken wisselt de status of maakt de rij aan
   (met pop-animatie). Boven de heatmap staat de voortgang van het jaar.
   Speciale edities komen als extra tegels erbij.
6. Pockets: tabs Pocket en Dubbel Pocket, lijst met wisselen, bewerken
   (via `prompt`) en verwijderen.
7. Snel opzoeken: type, jaar en nummer controleren, tikken om te wisselen.
8. Backup: knop 💾 (topbalk en kaart op het startscherm) bewaart
   `donald-duck-tracker-backup-JJJJ-MM-DD.json` met `app`, `version`,
   `exported_at` en `magazines`. Gebruikt het deelmenu (`navigator.share`
   met een bestand, op iOS "Bewaar in Bestanden") en valt terug op een
   gewone download. Draait synchroon binnen de tik, anders weigert iOS het
   deelmenu. Het moment van de laatste backup staat in `localStorage`
   (`dd_tracker_last_backup`) en wordt op het startscherm getoond.
9. Navigatie en `start()`: laadt de data, toont daarna het startscherm.
   Mislukt het laden, dan blijft het laadscherm met een foutmelding staan.

Er is geen realtime-sync. De lijst wordt stil ververst zodra de app weer op
de voorgrond komt (`visibilitychange`).

## iOS-details

- `index.html` heeft `viewport-fit=cover` en `black-translucent` als
  statusbalk. Elk element dat bovenaan of onderaan vastzit moet de
  safe-area-marge meenemen, anders valt het onder de notch of home-balk.
- Invoervelden zijn 16 px, anders zoomt iOS in.
- Backup via `navigator.share` werkt alleen direct na een tik. Doe dus geen
  `await fetch` vóór het delen.

## Service worker

Cache-naam `dd-tracker-v<versie>`. Strategie: uit de cache tonen en op de
achtergrond verversen, alleen voor GET-verzoeken naar dezelfde origin.
Verzoeken naar `/api/` worden nooit onderschept, anders zie je verouderde
data.

## Regels voor wijzigingen

- Geen frameworks, bundlers, build-stappen of dependencies toevoegen.
  Blijft vanilla HTML/CSS/JS.
- Functies in `app.js` klein en overzichtelijk houden, geen premature
  abstracties.
- Bij elke live-deploy met inhoudelijke wijziging: `APP_VERSION` in `app.js`
  (zichtbaar in de header) en `CACHE` in `sw.js` samen ophogen, anders blijven
  PWA-gebruikers een oude versie zien. Alleen docs of config: niet nodig.
- Wijzigingen op `main` gaan direct live. Test grotere wijzigingen eerst op
  een branch (preview-URL).
- Schemawijzigingen: pas `schema.sql` en de whitelists in `api/magazines.js`
  samen aan en draai de migratie zelf in Neon.
- Houd `CLAUDE.md` en `README.md` in lijn met de code.
