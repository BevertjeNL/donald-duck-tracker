# 🦆 Donald Duck Tracker

Een kleine Progressive Web App om bij te houden welke nummers van
**Donald Duck Weekblad**, **Katrien Duck Weekblad** en **Pockets** je al
gelezen hebt, per jaargang en met een heatmap.

**Live:** https://donald-duck-tracker.vercel.app/

## Wat kan de app

- **Donald Duck Weekblad:** per jaargang, week 1 t/m 52, als heatmap. Tik op
  een tegel om gelezen of ongelezen te wisselen.
- **Katrien Duck Weekblad:** per jaargang, maand 1 t/m 12.
- **Pockets en Dubbel Pockets:** lijst met nummer en thema of titel. Wisselen,
  bewerken en verwijderen.
- **Speciale edities** toevoegen aan een jaargang.
- **Jaargangen:** vanaf 2017, met `+ jaar` voor andere jaren.
- **Snel opzoeken:** controleer of een specifiek nummer al gelezen is.
- **Backup:** de knop 💾 bewaart alles als
  `donald-duck-tracker-backup-JJJJ-MM-DD.json`. Op iPhone opent het
  deelmenu (kies "Bewaar in Bestanden"), elders wordt het bestand gedownload.
  Het startscherm toont hoe lang geleden je laatste backup was.
- **PWA:** op je beginscherm te zetten (iOS en Android), met eigen icoon.
  De app-bestanden worden gecachet, maar zonder internet laadt de data niet.
- Je voortgang staat in een database, dus op elk apparaat hetzelfde.
  Wijzigingen van een ander apparaat zie je na herladen.

## Hoe het werkt

```
Browser (index.html + app.js)  --fetch-->  /api/magazines  --HTTPS-->  Neon Postgres
```

- **Frontend:** vanilla HTML, CSS en JavaScript. Geen framework, geen
  build-stap, geen `package.json`.
- **API:** één Vercel-functie (`api/magazines.js`) die lezen, toevoegen,
  wijzigen en verwijderen doet, zonder dependencies.
- **Database:** [Neon](https://neon.com) Postgres, tabel `magazines`
  (zie `schema.sql`).
- **Hosting:** [Vercel](https://vercel.com), automatisch gedeployed vanaf de
  `main` branch.
- Er is geen inlogscherm. Wie de URL kent, kan lezen en schrijven. Maak daarom
  af en toe een backup.

## Zelf opzetten

1. Maak een Neon-project en draai `schema.sql` in de SQL-editor.
2. Maak een Vercel-project gekoppeld aan deze repo. Zet de Neon connection
   string als omgevingsvariabele `DATABASE_URL` (production en preview).
3. Zet Vercel Authentication uit voor het project, anders vraagt de app om een
   Vercel-login.
4. Push naar `main`, Vercel deployt vanzelf.

Lokaal draaien kan met `vercel dev` (de pagina heeft `/api` nodig). Alleen
`index.html` openen werkt niet.

## Bestanden

```
index.html        Alle markup, één pagina met meerdere views
app.js            Alle applicatielogica
style.css         Styling (donker navy/goud thema)
api/magazines.js  Serverfunctie: lezen en schrijven naar Neon
schema.sql        Databaseschema voor Neon
sw.js             Service worker (cache van de app-shell, nooit van /api)
manifest.json     PWA-manifest
icons/            App-iconen (192, 512, 1024 en apple-touch-icon)
CLAUDE.md         Technische uitleg voor AI-sessies
```

Versie: 2.2.0
