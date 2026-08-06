# 🦆 Donald Duck Tracker

Een kleine Progressive Web App om bij te houden welke nummers van
**Donald Duck Weekblad**, **Katrien Duck Weekblad** en **Pockets** je
al gelezen hebt — per jaargang, met een overzichtelijke heatmap.

**Live:** https://bevertjenl.github.io/donald-duck-tracker/

## Wat kan de app

- **Donald Duck Weekblad** — bijhouden per jaargang, week 1 t/m 52
- **Katrien Duck Weekblad** — bijhouden per jaargang, maand 1 t/m 12
- **Pockets & Dubbel Pockets** — losse lijst met nummer en thema/titel
- Speciale edities toevoegen aan een jaargang
- Snel opzoeken of een specifiek nummer al gelezen is
- Werkt als PWA: toe te voegen aan je beginscherm (iOS/Android) met
  eigen icoon, en werkt met een service worker deels offline
- Data wordt gesynchroniseerd via Supabase, dus je voortgang staat
  klaar op elk apparaat

## Opstarten

Dit is een **vanilla HTML/CSS/JS** project zonder build-stap — er is
geen `npm install` of compileerstap nodig.

1. Clone de repo
2. Open `index.html` direct in de browser, of serveer de map lokaal
   met een eenvoudige static server, bijvoorbeeld:
   ```bash
   npx serve .
   ```
3. Klaar — de app praat rechtstreeks met Supabase voor data-opslag.

## Tech stack

- HTML, CSS en JavaScript, geen framework
- [Supabase](https://supabase.com) voor authenticatie en dataopslag
- GitHub Pages voor hosting, gedeployed vanaf de `main` branch

## Bestandsstructuur

```
index.html      Alle markup / pagina-secties
app.js          Alle applicatielogica
style.css       Styling
manifest.json   PWA-manifest
sw.js           Service worker (offline/cache)
supabase.sql    Databaseschema (tabel + RLS-policies)
icons/          App-iconen
```
