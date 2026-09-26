# StreamHub V1.0.1 – bestätigte Ablaufdaten

Deine persönliche Streaming-Zentrale für Netflix, Prime Video, Disney+, Paramount+, Apple TV+ und Crunchyroll.

## Starten

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. `.env.example` nach `.env.local` kopieren und den persönlichen **TMDB API Read Access Token** sowie den kostenlosen **Streaming Availability API Key** eintragen:

   ```env
   TMDB_READ_TOKEN=DEIN_TOKEN
   STREAMING_AVAILABILITY_API_KEY=DEIN_API_KEY
   ```

3. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

4. [http://localhost:3000](http://localhost:3000) öffnen.

Ohne Token startet StreamHub automatisch mit Demo-Daten. Die Datei `.env.local` wird durch `.gitignore` vom Hochladen ausgeschlossen.

## Lokale Cache-Datenbank

StreamHub verwendet eine lokale SQLite-Datenbank unter `.streamhub-data/streamhub.sqlite`. Dafür wird Node.js 22.5 oder neuer benötigt. Die Datei bleibt auf dem eigenen Rechner und ist über `.gitignore` ausgeschlossen.

Die Datenbank enthält:

- einen transaktionalen API-Cache mit Ablaufzeiten und Schutz vor parallelen Doppelanfragen
- normalisierte Titel-, Anbieter- und Titel-Anbieter-Tabellen
- einen lokalen Volltextindex für Titel, Originaltitel und Beschreibungen
- sieben Tage wiederverwendbare Titelmetadaten
- höchstens sechs Stunden alte Streaming-Verfügbarkeiten und Suchergebnisse
- höchstens drei Stunden alte bestätigte Ablaufdaten

Der bisherige Cache aus `.streamhub-data/cache-v1.json` wird beim ersten Start automatisch übernommen. Danach schreibt StreamHub nur noch gezielt betroffene Datensätze, anstatt bei jeder Änderung eine vollständige JSON-Datei neu zu speichern. Der lokale Katalog wächst automatisch mit jeder Suche und jeder geöffneten Kategorie. Dadurch werden bereits bekannte Suchanfragen und Inhalte ohne erneute externe API-Aufrufe ausgeliefert.

Unter [`/api/health`](http://localhost:3000/api/health) zeigt StreamHub unter anderem Datenbankgröße, Cache-Einträge, indizierte Titel, Anbieter-Verknüpfungen und Cache-Treffer an.

## Neu in V1.0.1

- die Seite „Läuft bald ab“ zeigt als ersten Tab echte Katalog-Abgänge der aktiven Dienste
- unbekannte oder geschätzte Termine werden bewusst ausgeschlossen; angezeigt werden nur konkrete letzte Verfügbarkeitstage für Deutschland
- Meldungen betreffen ausschließlich vollständige Filme oder Serien, nicht einzelne Staffeln oder Folgen
- jeder Eintrag nennt den betroffenen Dienst, das genaue Datum und – sofern verifiziert – dessen exakten Titellink
- persönliche Abo-Enden bleiben als eigener zweiter Tab erhalten
- auf der Startseite erscheint eine Netflix-artige Ablauf-Bahn; Watchlist-Titel stehen darin zuerst
- läuft eine Serie aus der Watchlist bald bei einem aktiven Dienst ab, legt StreamHub automatisch eine Benachrichtigung an
- Ablaufdaten werden drei Stunden lokal zwischengespeichert, um zusätzliche API-Aufrufe gering zu halten

## Neu in V1.0

- bestehende, manuell geprüfte Reihenfolgen behalten immer Vorrang
- die Suche kann für weitere Serien und Filmsammlungen automatisch eine deutlich markierte Reihenfolge prognostizieren
- Serien werden vorsichtig nach Staffelnummer und Erstausstrahlung, Filmsammlungen nach Veröffentlichung geordnet
- jede automatisch erzeugte Liste erklärt ihre Datenbasis und behauptet nicht, redaktionell geprüft zu sein
- Stationen verwenden individuelle Film-, Staffel- oder Episodenmotive statt eines mehrfach wiederholten Franchise-Bildes
- ein kleiner persistenter lokaler Datencache reduziert TMDB- und Streaming-Availability-Aufrufe auch über Server-Neustarts hinweg
- stabile Metadaten bleiben sieben Tage, Streaming-Verfügbarkeit sechs Stunden im Cache
- Cache, API-Schlüssel, Build-Ausgaben und persönliche Einstellungen werden nicht mit einem Projekt-ZIP geteilt

## Enthalten seit V0.9 – Reihenfolgen

- eigene Seite „Reihenfolgen“ für kuratierte Film-, Serien-, Staffel- und Special-Abfolgen
- Story-/Empfehlungsreihenfolge und Veröffentlichungsreihenfolge umschaltbar
- sieben kuratierte Sammlungen: Sword Art Online, Attack on Titan, Demon Slayer, Marvel Infinity Saga, Star Wars, Wizarding World und Mittelerde
- eigene Filter für Film- und Anime-Reihenfolgen
- Sword Art Online beginnt mit den Folgen 1–3, ordnet danach Aria of a Starless Night und Scherzo of Deep Night ein und setzt anschließend Aincrad fort
- alle Motive des Reihenfolgen-Bereichs sind bewusst ausgewählt; sexualisierte SAO-Motive werden dort nicht mehr verwendet
- erheblich größere Schrift und höhere Stationen für gute Lesbarkeit auf großen Monitoren
- optionale Spin-offs, Nacherzählungen und alternative Fassungen sind deutlich gekennzeichnet
- jede Station öffnet die vorhandene StreamHub-Detailansicht und – falls verifiziert – den exakten Anbieterlink
- Fortschritt pro Reihenfolge: einzelne Stationen als angesehen markieren oder komplett zurücksetzen
- Reihenfolgen liken und dauerhaft lokal speichern
- eigener Watchlist-Tab für gespeicherte Reihenfolgen
- die normale Suche und passende Titel-Detailansichten verlinken direkt zur erkannten chronologischen Reihenfolge
- mobile Navigation enthält einen festen Zugang zu „Reihenfolgen“

## Enthalten seit V0.81

- alle Reihenüberschriften verwenden passende Motive aus dem jeweiligen Inhalt statt generischer Symbole
- Kategorie-Schaltflächen und Kategorie-Bahnen wechseln ihre passenden Motive automatisch alle 18 Sekunden
- ein Kategorien-Klick öffnet einen großen Katalog mit Infinite Scroll, erneutem Mehrfach-Dienstefilter und eigener Kategorie-Suche
- die Anime-Kategorie kombiniert Anime-Filme und Anime-Serien in derselben Ansicht
- deutlich größere, besser lesbare Folgentitel, Metadaten und Beschreibungen
- eigene, vollständig gestaltete Staffelauswahl statt des nativen Browser-Menüs
- echte Anbieterlogos in der kompakten Diensteübersicht und auf den Abo-Karten

## Enthalten seit V0.8

- Serien zeigen in der Detailansicht eine elegante Staffel- und Folgenliste
- Folgen erhalten ein echtes Szenenbild sowie lokalisierte deutsche Titel und Beschreibungen aus TMDB
- die Staffel lässt sich direkt auswählen; lange Folgentitel werden sauber gekürzt
- ein Klick auf eine Folge öffnet den exakten Episodenlink bei einem deiner aktiven Dienste
- bei mehreren verfügbaren Diensten sind alle Anbieter pro Folge sichtbar und einzeln anklickbar
- pro Staffel bleibt der Hauptbutton beim abonnierten Dienst mit der größten Folgenabdeckung, statt zwischen Anbietern zu wechseln
- falsch zusammengefasste Staffeln werden anhand der TMDB-Folgenstruktur neu aufgeteilt; ein verifizierter Staffellink kann fehlende einzelne Episodenlinks beim bevorzugten Dienst sicher ersetzen
- bei bekannten Datenlücken können geprüfte offizielle Serienseiten als letzter Fallback dienen; sie werden klar als „Serie öffnen“ gekennzeichnet und niemals aus einer Namenssuche erzeugt
- eigene aktive Dienste stehen farbig vorn; andere Dienste und fehlende Folgenlinks sind ausgegraut
- Kategorie-Schaltflächen und die zugehörigen Zielreihen verwenden passende genrebezogene TMDB-Bilder
- `videoLink` wird bevorzugt; andernfalls wird nur die bestätigte Episodenseite des Anbieters verwendet
- ohne verifizierten Link gibt es keinen unzuverlässigen Such- oder TMDB-Fallback
- Folgen- und Direktlinkdaten werden serverseitig zwischengespeichert; der API-Key gelangt nie in den Browser

## Enthalten seit V0.7

- verbesserte Suche nach Titel, Originaltitel, Jahr, Medientyp und Kategorie
- alle erkannten Streaming-Anbieter als Icons pro Titel
- aktive Abos stehen farbig im Vordergrund; weitere Anbieter folgen deutlich ausgegraut
- lange Titelnamen enden sauber mit „…“ und werden beim Darüberfahren vollständig angezeigt
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
- Anbieter ohne exakten Direktlink werden nicht als Schaltfläche angezeigt; ihr Verfügbarkeits-Symbol erscheint ausgegraut
- Profilzugang auf kleinen Fenstern über die mobile Navigation
- Suche, Profil, Benachrichtigungen, Seitenmenü und Detailansicht schließen zuverlässig beim Klick außerhalb
- Next.js-/Turbopack-Info im Profilmenü; der Next.js-Dev-Indikator ist deaktiviert
- Notification Center und Abo-Verwaltung bleiben erhalten

## Hinweise zu Streaming-Links

StreamHub verbindet TMDB-Katalogdaten mit den exakten Zielen der Streaming Availability API und lässt nur geprüfte HTTPS-Links auf den bekannten Anbieter-Domains zu. Gibt es für einen Titel oder eine Folge keinen verifizierbaren Direktlink, zeigt StreamHub keinen unzuverlässigen Such- oder TMDB-Fallback an.

Folgen- und Direktlinkdaten bereitgestellt von Streaming Availability API by Movie of the Night. Region: Deutschland.

## Nächster Schritt

- weitere Streaming-Dienste mit eigenen Logos selbst hinzufügen und verwalten
- Studiosuche: Begriffe wie Marvel, Studio Ghibli, Pixar oder DreamWorks sollen ausschließlich Titel des ausgewählten Studios zeigen
