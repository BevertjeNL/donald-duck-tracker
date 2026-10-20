# 🦆 Donald Duck Tracker

Een kleine Progressive Web App om bij te houden welke nummers van
**Donald Duck Weekblad**, **Katrien Duck Weekblad** en **Pockets** je
al gelezen hebt — per jaargang, met een overzichtelijke heatmap.

**Live:** https://donald-duck-tracker.vercel.app/

## Wat kan de app

- **Donald Duck Weekblad** — bijhouden per jaargang, week 1 t/m 52
- **Katrien Duck Weekblad** — bijhouden per jaargang, maand 1 t/m 12
- **Pockets & Dubbel Pockets** — losse lijst met nummer en thema/titel
- Speciale edities toevoegen aan een jaargang
- Snel opzoeken of een specifiek nummer al gelezen is
- Werkt als PWA: toe te voegen aan je beginscherm (iOS/Android) met
  eigen icoon, en werkt met een service worker deels offline
- Data staat in Neon (Postgres), dus je voortgang staat
  klaar op elk apparaat

## Opstarten

Dit is een **vanilla HTML/CSS/JS** project zonder build-stap — er is
geen `npm install` of compileerstap nodig.

1. Clone de repo
2. Draai `schema.sql` in je Neon-database en zet `DATABASE_URL` als
   omgevingsvariabele in Vercel
3. Lokaal draaien kan met `vercel dev`; de gewone `index.html` heeft de
   `/api`-functie nodig.

## Tech stack

- HTML, CSS en JavaScript, geen framework
- [Neon](https://neon.com) Postgres voor dataopslag
- Vercel voor hosting en de serverfunctie, gedeployed vanaf de `main` branch

## Bestandsstructuur

```
index.html      Alle markup / pagina-secties
app.js          Alle applicatielogica
style.css       Styling
manifest.json   PWA-manifest
sw.js           Service worker (offline/cache)
schema.sql      Databaseschema voor Neon
api/            Serverfunctie voor lezen en schrijven
icons/          App-iconen
```
