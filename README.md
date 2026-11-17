# Einsamer Wolf

Eine responsive Webseite mit dem Titel **Einsamer Wolf**, eigener SVG-Waldillustration und deutschen Texten. Keine externen Schriftarten, Bilddienste oder Laufzeit-Abhängigkeiten.

Die technische Struktur orientiert sich an [Wegweiser](https://github.com/tiljaeger/Wegweiser): TypeScript, Vite, Cloudflare Workers mit Static Assets und GitHub Actions für automatische Prüfungen. Eine lokale Spielkarte ergänzt den Charakterbogen; Routingdienste werden nicht verwendet.

## Digitaler Charakterbogen

Die Webseite enthält ein Aktionsblatt und ein Kampfprotokoll. Die beiden Register wechseln zwischen den Formularseiten. Eingaben werden automatisch im LocalStorage dieses Browsers auf diesem Gerät gespeichert. Ein Browserwechsel, privater Modus oder das Löschen von Websitedaten kann dazu führen, dass Einträge nicht verfügbar sind. Über **Daten exportieren** lässt sich ein JSON-Backup herunterladen und später über **Daten importieren** wiederherstellen. Ungültige Dateien werden abgelehnt, ohne gespeicherte Daten zu ersetzen. **Zurücksetzen** löscht die Einträge nach Bestätigung.

**PDF erstellen** öffnet den Druckdialog des Browsers: Dort „Als PDF speichern“ wählen. Beide Seiten werden mit ihren eingetragenen Werten und ohne Bedienknöpfe ausgegeben. Im Seitenlayout kann bei Bedarf die Skalierung angepasst werden.

Das Design folgt der Beschreibung in Issue #2; die dort genannten Originalfotos lagen bei der Umsetzung noch nicht vor und sind für einen genauen Abgleich erforderlich.

## Als App installieren und offline nutzen

Die Webseite ist als Progressive Web App (PWA) installierbar. Zuerst die Webseite mit Internetverbindung öffnen und kurz warten, damit die für die Offline-Nutzung benötigten Dateien gespeichert werden.

- **iPhone/iPad:** In Safari öffnen, auf „Teilen“ und anschließend „Zum Home-Bildschirm“ tippen.
- **Android:** In Chrome die Webseite öffnen und im Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen. Die genaue Bezeichnung hängt vom Gerät und Browser ab.
- **Desktop:** In einem unterstützten Browser die Installationsfunktion in der Adressleiste oder im Browsermenü auswählen.

Anschließend die installierte App bei bestehender Verbindung einmal öffnen. Danach lassen sich die heruntergeladenen Seiten auch ohne Internetverbindung aufrufen. Aktualisierungen werden geladen, sobald wieder eine Verbindung besteht; eine neue Version wird aktiv, nachdem ältere App-Fenster geschlossen wurden.

Die Einträge verbleiben lokal. Browser und installierte App können getrennte Speicher verwenden, insbesondere auf iPhone und iPad. Um einen bestehenden Bogen zu übernehmen, zuerst im Browser als JSON exportieren und dann in der installierten App importieren. Daten regelmäßig als JSON sichern: Beim Löschen von Website- oder App-Daten können lokale Einträge verloren gehen.

## Einrichtung und Ausführung

Voraussetzung: Node.js 24 LTS mit npm (siehe `.nvmrc`).

```sh
npm ci
npm run dev
```

Vite startet unter `http://127.0.0.1:5173`. Für die vollständige lokale Worker-Umgebung:

```sh
npm run dev:worker
```

Wrangler baut das Frontend nach `dist/` und stellt die Webseite unter `http://127.0.0.1:8787` bereit.

## Prüfungen

```sh
npm test
npm run typecheck
npm run lint
npm run build:worker
```

Der Worker-Dry-Run enthält den Vite-Produktionsbuild und veröffentlicht nichts. GitHub Actions führt diese Prüfungen bei Pull Requests und Änderungen auf `main` aus.

## Auf Cloudflare veröffentlichen

Mit einem Cloudflare-Konto anmelden und veröffentlichen:

```sh
npx wrangler login
npm run deploy
```

Alternativ `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` sicher in der Ausführungsumgebung hinterlegen. Der Token benötigt die Berechtigung zum Bearbeiten von Cloudflare Workers und Static Assets im Zielkonto. Zugangsdaten niemals einchecken.

Wrangler veröffentlicht den Worker `einsamer-wolf` und gibt dessen tatsächliche `workers.dev`-URL aus. Die Adresse lässt sich vor einem erfolgreichen Deployment nicht verlässlich bestimmen.

Der GitHub-Workflow **Deploy to Cloudflare** lässt sich manuell starten. Dafür unter Settings → Secrets and variables → Actions die Repository-Secrets `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` hinterlegen. Der Workflow prüft und baut die Webseite, veröffentlicht sie und schreibt die Deployment-URL in das Job-Protokoll.

## Projektaufbau

- `index.html`: deutscher Seitentitel, Inhalt und eigene SVG-Illustration
- `src/main.ts`, `src/style.css`: Vite-Einstieg und responsive Gestaltung
- `worker/index.ts`: Weiterleitung an Cloudflare Static Assets
- `wrangler.jsonc`: Worker-Name und Asset-Konfiguration
- `.github/workflows/ci.yml`: automatische Typprüfung, Linting und Worker-Build
- `.github/workflows/deploy.yml`: manuelles Cloudflare-Deployment

Tastaturfokus, mobiles Layout, SVG-Bildbeschreibung und reduzierte Bewegung werden berücksichtigt. Die Illustrationen und Texte wurden für dieses Projekt erstellt. Ein lokaler Build allein veröffentlicht die Seite noch nicht.

## Spielkarte (Issue #3)

Das Register **Spielkarte** steht im Browser und in der PWA zur Verfügung. Zuerst eine Aktion wählen und dann auf die Karte klicken/tippen: Standort setzen, Wegpunkt hinzufügen oder Ort hinzufügen. Im Verschiebemodus lässt sich die Karte ziehen; die Zoomknöpfe funktionieren auch auf Touchgeräten. In der fokussierten Karte verschieben die Pfeiltasten den Ausschnitt, +/− zoomen. Die Koordinateneingabe ist eine Alternative zum Kartenklick und verwendet X = 0–1000, Y = 0–700 (von links oben).

Die nummerierten Wegpunkte bilden den Reiseweg in ihrer Reihenfolge. Über **Verschieben** und eine neue Kartenposition oder Koordinateneingabe lassen sich Standort, Wegpunkte und Orte versetzen. **Löschen** entfernt einzelne Einträge. Ein Klick auf einen Ort im Verschiebemodus fokussiert dessen Editor. Namen, optionale Notizen und Kategorien (Ort, Gefahr, Lager) werden bei gültiger Eingabe automatisch gespeichert; **Ort speichern** aktualisiert zusätzlich die Darstellung. Der letzte gültige Ortsname bleibt erhalten, wenn ein Name geleert wird.

Kartendaten liegen gemeinsam mit dem Charakterbogen im bestehenden lokalen Speicher und JSON-Backup. Ältere Backups ohne `karte` werden mit einer leeren Karte importiert. Import ersetzt den gesamten aktuellen Stand, einschließlich Karte. Zurücksetzen löscht nach Bestätigung auch die Kartendaten. Ungültige Kartendaten werden vor dem Ersetzen abgelehnt. Kein GPS, keine externen Kartenanfragen und keine Übertragung der Einträge. Wie beim Charakterbogen empfiehlt sich regelmäßiger JSON-Export.

### Kartenquelle, Rechte und Austausch

Als Rechercheansatz für veröffentlichte Magnamund-Karten dient [Project Aon – Maps](https://www.projectaon.org/en/Main/Maps); die [Project-Aon-Lizenz](https://www.projectaon.org/en/Main/License) ist gesondert zu prüfen. Der Abruf war in dieser Arbeitsumgebung am 17.11.2026 durch die Netzwerkregel mit HTTP 403 gesperrt. Daher sind konkrete Wiederverwendungs-, Bearbeitungs- und Offline-Rechte hier **nicht verifiziert**. Fremde Karten wurden weder kopiert noch eingebunden; eine frei zugängliche Abbildung allein gilt nicht als Nutzungserlaubnis.

Die mitgelieferte Grundlage `public/maps/reisekarte.svg` ist eine für dieses Projekt selbst erstellte schematische Illustration, keine geografisch genaue oder offizielle Magnamund-Karte. Sie wird unter **CC0 1.0 Universal** bereitgestellt ([Rechtstext](https://creativecommons.org/publicdomain/zero/1.0/)); Vervielfältigung, Bearbeitung und Offline-Speicherung sind erlaubt, ein Quellenhinweis ist nicht vorgeschrieben. Die Oberfläche kennzeichnet sie als eigene Skizze. Sie nutzt keine fremden Kartenkacheln, Schriftarten oder Bildbestandteile.

Für eine spätere, rechtlich geprüfte Karte die Datei ersetzen oder `MAP_BACKGROUND` in `src/map.ts` ändern. Das Overlay verwendet einen festen Raum von 1000 × 700 Einheiten. Eine neue Grundlage sollte auf diesen Raum abgestimmt werden; andernfalls müssen bestehende Positionen migriert werden. Bei fremden Grundlagen Attribution, Lizenz und Offline-Rechte vor Einbindung erneut prüfen. Der vorhandene Service Worker nimmt die lokale SVG und das Kartenmodul automatisch in den App-Cache auf. Nach vollständiger Installation ist die Karte offline nutzbar; Browser können Cache und lokale Daten löschen. Ein abgebrochener erster Download garantiert keine Offline-Verfügbarkeit.

## Spielregeln (Issue #5)

Das Register **Spielregeln** enthält alle sechs Kapitel für Band 1 aus Issue #5 (eigenständige Zusammenfassungen nach Nutzerfotos der Mantikore-Ausgabe, S. 18–29). Die Inhalte werden separat in `src/rules-data.json` als Kapitel mit stabilen IDs und Markdown gepflegt. Der HTML-Renderer unterstützt Absätze, fett markierte Begriffe, Listen und Tabellen und maskiert HTML.

Direktlinks wie `/#rules-kampf`, `/#rules-disziplinen`, `/#heilung` und `/#waffenkunde` öffnen das Handbuch automatisch. Aktionsblatt, Inventar und Kampfprotokoll bieten Regelverweise. Der Kai-Rang folgt der Zahl unterschiedlicher, nicht leerer Disziplin-Einträge; ein leerer Bogen erhält keinen angenommenen Startrang. Das bestehende Band-1-Formular behält seine fünf Disziplinfelder. Spielmechaniken und gespeichertes Datenformat bleiben unverändert.

Die vollständige Kampfresultat-Tabelle und Zufallszahlentabelle fehlen weiterhin und werden ausdrücklich als ausstehend markiert. Das Regelbeispiel ersetzt keine vollständige Tabelle. Es erfolgt keine automatische Kampfauswertung. Die Regeltexte sind im App-Bundle enthalten und stehen nach Installation des Service Workers auch offline in der PWA bereit. Nach einem Update alle offenen App-Fenster schließen und erneut öffnen, damit der neue Service Worker aktiviert wird.

Prüfung: 14 einzelne Tests (Inhalte, Anker, Renderer, Rang, Speicherung und PWA), Typprüfung, ESLint und Worker-Dry-Run erfolgreich. Produktionsbuild in Chromium bei 1280 und 390 Pixeln geprüft: Register, Inhaltsverzeichnis, Kontextlink, Direktlink nach Reload, dynamischer Rang und Offline-Reload des Handbuchs; kein horizontaler Überlauf oder JavaScript-Fehler.
