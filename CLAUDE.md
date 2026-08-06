# CLAUDE.md

Spiekbriefje voor toekomstige AI-sessies op deze repo.

## Wat dit is

Donald Duck Tracker: een Progressive Web App om bij te houden welke
nummers van Donald Duck Weekblad, Katrien Duck Weekblad en Pockets je
al gelezen hebt.

**Dit is een Single-Page Vanilla HTML/JS app. Geen build-stap, geen
framework (geen React/Vue/etc), geen bundler, geen package.json.**
De bestanden worden direct, ongewijzigd geserveerd door GitHub Pages.
Niet voorstellen om een build-tool, framework of bundler te
introduceren — dat past niet bij dit project.

## Bestandsstructuur

- `index.html` — alle HTML/markup, één pagina met meerdere `.view`
  secties die met JS worden getoond/verborgen (geen router).
- `app.js` — alle logica: Supabase-auth, data ophalen/opslaan,
  DOM-rendering. Eén bestand, geen modules/imports.
- `style.css` — alle styling. CSS-variabelen bovenaan (`:root`) voor
  het kleurenpalet (donker navy/goud thema).
- `manifest.json` — PWA-manifest (iconen, naam, thema-kleur).
- `sw.js` — service worker voor offline/cache-gedrag. **Bump de
  `CACHE`-naam bij elke inhoudelijke wijziging**, anders blijven
  installed/PWA-gebruikers een oude versie zien.
- `supabase.sql` — schema voor de `magazines`-tabel (met RLS-policies).
- `icons/` — app-iconen (192/512/1024px + apple-touch-icon), gegenereerd
  als PNG's vanuit een los HTML/SVG-ontwerp (geen bronbestand hiervan
  in de repo — bij een nieuw icoon opnieuw ontwerpen en exporteren).

## Backend

Supabase wordt gebruikt voor auth + data (tabel `magazines`, RLS
per `user_id`). **Let op:** dit project deelt zijn Supabase-project
met een ander project (Reisplanner) — er is geen eigen Supabase-project
voor Donald Duck Tracker. Raak dus nooit Reisplanner-tabellen, de
Site URL, of andere gebruikers in dat project aan.

De app logt automatisch in met een vast account (zie `FIXED_EMAIL`/
`FIXED_PASSWORD` bovenin `app.js`) — er is bewust geen inlogscherm.

## Hosting

Statische hosting via **GitHub Pages**, gedeployed vanaf de `main`
branch. Geen Vercel, geen CI-build — wat in `main` staat is (na de
Pages-deploy) direct live op `https://bevertjenl.github.io/donald-duck-tracker/`.

## Regels voor wijzigingen

- Geen frameworks, bundlers of build-stappen toevoegen. Blijft vanilla
  HTML/CSS/JS.
- Houd functies in `app.js` klein en overzichtelijk; geen premature
  abstracties voor dingen die maar op één plek gebruikt worden.
- Geen dependencies toevoegen tenzij expliciet gevraagd (de enige
  externe dependency is de Supabase JS-client via een `<script>`-tag
  in `index.html`).
- Bump het versienummer (`APP_VERSION` in `app.js`, zichtbaar in de
  header) en de `CACHE`-naam in `sw.js` bij elke live-deploy, zodat
  gebruikers niet vastzitten aan een verouderde cache.
- Wijzigingen op `main` gaan direct live — er is geen aparte
  staging-omgeving.
