# StreamHub V0.7

Deine persönliche Streaming-Zentrale für Netflix, Prime Video, Disney+, Paramount+, Apple TV+ und Crunchyroll.

## Starten

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. `.env.example` nach `.env.local` kopieren und den persönlichen **TMDB API Read Access Token** eintragen:

   ```env
   TMDB_READ_TOKEN=DEIN_TOKEN
   ```

3. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

4. [http://localhost:3000](http://localhost:3000) öffnen.

Ohne Token startet StreamHub automatisch mit Demo-Daten. Die Datei `.env.local` wird durch `.gitignore` vom Hochladen ausgeschlossen.

## Neu in V0.7

- verbesserte Suche nach Titel, Originaltitel, Jahr, Medientyp und Kategorie
- alle erkannten Streaming-Anbieter als Icons pro Titel
- getrennte und personalisierte Reihen für Filme, Serien und Anime
- Netflix-artige Carousels mit Pfeilnavigation ohne sichtbare horizontale Scrollleisten
- Kategorien als eigene, optisch aufgewertete Bahnen
- zuverlässige Kategorie-Sprünge für alle 14 Kategorien ohne Seitenversatz beim Nachladen
- automatisches Nachladen weiterer Kategorien beim Scrollen ans Seitenende
- deutlich mehr Inhalte bei „Alle aktiven Dienste“ durch viele getrennte, lazy geladene Reihen
- kombinierbarer Dienstefilter mit Mehrfachauswahl, z. B. Netflix und Crunchyroll gleichzeitig
- Watchlist-Schaltfläche oben links in der Detailansicht
- kompakte Übersicht „Deine Dienste“ direkt in den Einstellungen
- echte, passende TMDB-Bildmotive für jede Kategorie statt Emojis
- scharfe, kontrastreiche Film-/Serien-/Anime-Kennzeichnung
- verifizierte Direktlinks zum exakten Titel bei Netflix, Disney+ und weiteren Anbietern
- Profilzugang auf kleinen Fenstern über die mobile Navigation
- Next.js-/Turbopack-Info im Profilmenü; der Next.js-Dev-Indikator ist deaktiviert
- Notification Center und Abo-Verwaltung bleiben erhalten

## Hinweise zu Streaming-Links

StreamHub wertet die exakten, von JustWatch/TMDB bereitgestellten Anbieter-Ziele serverseitig aus und lässt nur geprüfte HTTPS-Links auf den bekannten Anbieter-Domains zu. Gibt es für einen Titel keinen verifizierbaren Direktlink, zeigt StreamHub keinen unzuverlässigen Such- oder TMDB-Fallback an.

Streaming availability data powered by JustWatch via TMDB. Region: Deutschland.
