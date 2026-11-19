# AGENTS.md – Einsamer Wolf

## Ziel und Arbeitsweise

Einsamer Wolf ist eine deutschsprachige, responsive Begleit-App für Band 1 der Spielbuchreihe: Charakterbogen und Kampfprotokoll, Spielkarte, Regelhandbuch mit Tabellen sowie digitaler Kampfhelfer. Vor Änderungen README.md, betroffene Dateien und gegebenenfalls das zugehörige GitHub-Issue einschließlich neuerer Entscheidungen lesen. Aktuellen Code und Workflows bei Abweichungen prüfen; ältere Issue-Texte und historische Prüfberichte beschreiben nicht zwingend den aktuellen Stand. Unklare Spielregeln nicht erfinden.

Die Oberfläche und nutzerseitige Texte sind auf Deutsch. Bestehende Bedienbarkeit auf mobilen Geräten, Tastaturbedienung, sichtbare Fokuszustände und barrierearme Darstellung erhalten. Änderungen eng auf den Auftrag beschränken.

## Aufbau

- TypeScript und Vite, Node.js 24 gemäß `.nvmrc`; statische Assets werden durch einen Cloudflare Worker ausgeliefert.
- `index.html`, `src/main.ts` und CSS: Einstieg und Oberfläche.
- `src/forms.ts`, `src/state.ts`: Charakterbogen und Spielstand; `src/map.ts`, `src/map-state.ts`, `public/maps/reisekarte.svg`: Karte und Kartendaten.
- `src/rules-data.json`, `src/rules.ts`: Regeltexte und Darstellung; stabile Kapitel-IDs und bestehende Direktlinks erhalten.
- `src/table-model.ts`, `src/tables-data.ts`, `src/tables.ts`: Validierung, Datenzugriff und Darstellung der Tabellen.
- `src/combat-state.ts`, `src/combat.ts`: Kampfzustand/-berechnung und Oberfläche; `tests/`: automatisierte Tests.
- `worker/index.ts`, `wrangler.jsonc`: Worker und statische Assets; `scripts/generate-sw.mjs`: Service-Worker-Erzeugung.

## Fachliche und technische Leitplanken

- Als Referenz für die Tabellen ausschließlich `data/spielregeln/kampfresultat_gesamt.csv` und `data/spielregeln/zufallszahlen_tabelle.csv` verwenden; linke/rechte Teildateien nicht als zweite Quelle einlesen. Keine Tabellenwerte schätzen oder eine abweichende zweite Tabelle pflegen.
- Die Nachschlagetabellen verändern keinen Spielstand. Im Kampfhelfer sind Rundenvorschau und bestätigte Übernahme getrennt; gespeicherte Charakterwerte nicht ohne ausdrückliche Nutzeraktion überschreiben. Bestehende Kampfregeln und Sonderfälle anhand von Code, Regeln und Issue #7 prüfen.
- Spielstände bleiben lokal im Browser. JSON-Export/-Import, Validierung und Kompatibilität bestehender Daten schützen; bei Formatänderungen Migration und Tests vorsehen. Keine unnötige Übertragung von Spielerdaten einführen.
- Offline-Nutzung nach vollständigem Laden, PWA-Updates und lokale Assets erhalten. Externe Laufzeitdienste und Ressourcen nicht ohne entsprechende Anforderung einführen.
- Die mitgelieferte Karte ist eine eigene schematische Illustration, keine offizielle Karte. Bei Austausch Koordinatenraum und vorhandene Positionen berücksichtigen; Rechte, Quellenangaben und Offline-Nutzung fremder Materialien vor Einbindung prüfen.
- Fachlogik, Daten und Darstellung möglichst getrennt halten. Relevante Tests bei Verhaltensänderungen ergänzen oder anpassen.

## Einrichtung und Prüfungen

```sh
npm ci
npm run dev
```

Vite läuft lokal auf `http://127.0.0.1:5173`. `npm run dev:worker` startet die lokale Worker-Umgebung auf Port 8787. Für Änderungen die relevanten Prüfungen ausführen; die vollständige CI-Prüfung lautet:

```sh
npm test
npm run typecheck
npm run lint
npm run build:worker
```

`build:worker` ist ein Wrangler-Dry-Run mit Produktionsbuild und veröffentlicht nichts. Bei Änderungen an Oberfläche, Spielstand oder PWA zusätzlich die betroffenen Abläufe im Browser prüfen, insbesondere mobile Darstellung, Import/Export oder Offline-Verhalten, soweit relevant. Nicht ausgeführte Prüfungen und deren Grund im Ergebnis nennen.

## CI und Cloudflare-Deployment

- `.github/workflows/ci.yml` startet bei Pull Requests und Pushes auf `main`. Auf Ubuntu werden Node aus `.nvmrc`, `npm ci`, Tests, Typprüfung, Lint und Worker-Dry-Run ausgeführt.
- `.github/workflows/deploy.yml` heißt **Deploy to Cloudflare** und wird ausschließlich manuell über `workflow_dispatch` gestartet. Er führt dieselben Prüfungen aus und ruft anschließend `npm run deploy` auf. Ein Push oder ein erfolgreicher CI-Lauf veröffentlicht nicht automatisch.
- Der Deploy-Workflow verwendet die GitHub-Actions-Secrets `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`. Zugangsdaten nicht ausgeben, in Dateien schreiben oder einchecken. Keine Annahmen treffen, dass Secrets vorhanden oder gültig sind.
- `wrangler.jsonc` konfiguriert den Worker `einsamer-wolf`, den Einstieg `worker/index.ts`, den Build nach `dist/` und das Asset-Binding `ASSETS`. Das Deploy-Kommando veröffentlicht den Worker und die statischen Assets.
- Ein Deployment ist eine Veröffentlichung: nur im Rahmen des jeweiligen Auftrags auslösen. Danach den Workflow-Status und die ausgegebene URL prüfen und das Ergebnis samt eventuell fehlgeschlagener Schritte berichten. Einen Dry-Run nicht als Veröffentlichung darstellen.
