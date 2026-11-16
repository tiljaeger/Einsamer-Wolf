# Einsamer Wolf

Eine responsive Webseite mit dem Titel **Einsamer Wolf**, eigener SVG-Waldillustration und deutschen Texten. Keine externen Schriftarten, Bilddienste oder Laufzeit-Abhängigkeiten.

Die technische Struktur orientiert sich an [Wegweiser](https://github.com/tiljaeger/Wegweiser): TypeScript, Vite, Cloudflare Workers mit Static Assets und GitHub Actions für automatische Prüfungen. Karten- und Routingfunktionen sind nicht Teil dieser Webseite.

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
