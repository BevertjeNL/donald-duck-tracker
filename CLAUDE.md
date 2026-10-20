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
- `app.js` — alle logica: data ophalen/opslaan via `/api/magazines`,
  DOM-rendering. Eén bestand, geen modules/imports.
- `style.css` — alle styling. CSS-variabelen bovenaan (`:root`) voor
  het kleurenpalet (donker navy/goud thema).
- `manifest.json` — PWA-manifest (iconen, naam, thema-kleur).
- `sw.js` — service worker voor offline/cache-gedrag. **Bump de
  `CACHE`-naam bij elke inhoudelijke wijziging**, anders blijven
  installed/PWA-gebruikers een oude versie zien.
- `api/magazines.js` — Vercel-functie (CRUD op `magazines` in Neon, via
  Neon SQL-over-HTTP, zonder dependencies).
- `schema.sql` — schema voor de `magazines`-tabel in Neon.
- `icons/` — app-iconen (192/512/1024px + apple-touch-icon), gegenereerd
  als PNG's vanuit een los HTML/SVG-ontwerp (geen bronbestand hiervan
  in de repo — bij een nieuw icoon opnieuw ontwerpen en exporteren).

## Backend

Neon Postgres (project `donald-duck-tracker`, tabel `magazines`),
bereikt via de serverfunctie `api/magazines.js`. De connection string
staat als `DATABASE_URL` in de Vercel-omgevingsvariabelen. Er is bewust
geen inlogscherm en geen auth: het is een persoonlijke naslag-app.

## Hosting

**Vercel** (team `bevertje`), gedeployed vanaf de `main` branch van de
GitHub-repo. Statische bestanden plus de functie in `api/`. Geen build-stap.
De oude GitHub Pages-versie draait niet meer op deze code.

## Regels voor wijzigingen

- Geen frameworks, bundlers of build-stappen toevoegen. Blijft vanilla
  HTML/CSS/JS.
- Houd functies in `app.js` klein en overzichtelijk; geen premature
  abstracties voor dingen die maar op één plek gebruikt worden.
- Geen dependencies toevoegen tenzij expliciet gevraagd (er zijn er
  nu geen: geen `package.json`).
- Bump het versienummer (`APP_VERSION` in `app.js`, zichtbaar in de
  header) en de `CACHE`-naam in `sw.js` bij elke live-deploy, zodat
  gebruikers niet vastzitten aan een verouderde cache.
- Wijzigingen op `main` gaan direct live via Vercel; andere branches
  krijgen een preview-URL.
