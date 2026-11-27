import { mountCombatLog } from './combat-log';
import { mountCombat, renderCombat } from './combat';
import './combat.css';
import { referenceTables } from './tables-data';
import { renderTables, mountTables } from './tables';
import chapters from './rules-data.json';
import { renderRules, kaiRank } from './rules';
import './rules.css';
import { mountMap } from './map';
import './style.css';
import './sheet.css';
import { renderForms } from './forms';
import { createEmptyData, exportJSON, importJSON, loadData, parseCharacterData, saveData, type CharacterData } from './state';

const root = document.querySelector<HTMLElement>('#sheet-root');
if (!root) throw new Error('Der Charakterbogen konnte nicht initialisiert werden.');
root.innerHTML = `
  <div class="sheet-controls">
    <h1 id="sheet-app-title">Einsamer Wolf</h1>
    <nav class="sheet-tabs" aria-label="Spielansichten">
      <button type="button" data-tab="startseite" aria-controls="startseite" aria-pressed="true">Startseite</button>
      <button type="button" data-tab="spielkarte" aria-controls="spielkarte" aria-pressed="false">Spielkarte</button>
      <button type="button" data-tab="rules-title" aria-controls="spielregeln" aria-pressed="false">Regelhandbuch</button>
      <button type="button" data-tab="rules-kampfresultate" aria-controls="kampfresultate" aria-pressed="false">Kampfresultat-Tabelle</button>
      <button type="button" data-tab="rules-zufallszahlen" aria-controls="zufallszahlen" aria-pressed="false">Zufallszahlen-Tabelle</button>
    </nav>
  </div>
  <div class="sheet-pages">
    ${renderForms()}
    <section class="sheet-panel" id="spielkarte" aria-label="Spielkarte" tabindex="-1" hidden></section>
    ${renderRules(chapters)}
    <div id="regeltabellen" class="no-print">${renderTables(referenceTables)}</div>
    ${renderCombat(referenceTables)}
  </div>
  <div class="sheet-controls sheet-save-controls">
    <details>
      <summary>Spielstand und PDF</summary>
      <div class="sheet-actions">
        <button type="button" data-action="save">Speichern</button>
        <button type="button" data-action="reset">Zurücksetzen</button>
        <button type="button" data-action="print">PDF erstellen</button>
        <button type="button" data-action="export">Daten exportieren</button>
        <button type="button" data-action="import">Daten importieren</button>
        <input class="sheet-file" type="file" accept="application/json,.json" aria-label="JSON-Datei zum Import auswählen" hidden>
      </div>
    </details>
    <p class="sheet-status" role="status" aria-live="polite"></p>
  </div>`;

mountTables(root.querySelector<HTMLElement>('#regeltabellen')!, referenceTables);

const status = root.querySelector<HTMLElement>('.sheet-status')!;
const upload = root.querySelector<HTMLInputElement>('.sheet-file')!;
const fields = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-path]')];
let data = createEmptyData();
let storageReadable = true;

function setStatus(message: string): void { status.textContent = message; }
function getPath(object: CharacterData, path: string): string | number {
  let value: unknown = object;
  for (const key of path.split('.')) value = (value as Record<string, unknown>)[key];
  return value as string | number;
}
function setPath(object: CharacterData, path: string, value: string | number): void {
  const keys = path.split('.');
  let part: unknown = object;
  for (const key of keys.slice(0, -1)) part = (part as Record<string, unknown>)[key];
  (part as Record<string, unknown>)[keys[keys.length - 1]] = value;
}
function mirror(field: HTMLInputElement | HTMLTextAreaElement): void {
  const output = field.parentElement?.querySelector<HTMLElement>('.sheet-field-value');
  if (output) output.textContent = field.value;
}
function updateRank(): void {
  root!.querySelector<HTMLElement>('.kai-rank')!.textContent = kaiRank(data.aktionsblatt.kaiDisziplinen);
}
function syncFields(): void {
  updateRank();
  for (const field of fields) {
    field.value = String(getPath(data, field.dataset.path!));
    field.setCustomValidity('');
    mirror(field);
  }
}
function hasInvalid(): boolean { return fields.some(field => !field.validity.valid); }
function persist(message = 'Automatisch gespeichert.'): boolean {
  if (!storageReadable) { setStatus('Gespeicherte Daten konnten nicht gelesen werden. Zum erneuten Speichern bitte Daten importieren oder den Bogen bewusst zurücksetzen.'); return false; }
  try { saveData(data); setStatus(message); return true; }
  catch { setStatus('Speichern im Browser fehlgeschlagen. Bitte prüfe die Browsereinstellungen und sichere deine Daten als JSON.'); return false; }
}
function activate(id: string): void {
  for (const panel of root!.querySelectorAll<HTMLElement>('.sheet-panel')) panel.hidden = panel.id !== id;
  for (const button of root!.querySelectorAll<HTMLButtonElement>('[data-tab]')) button.setAttribute('aria-pressed', String(button.getAttribute('aria-controls') === id));
}

try { data = loadData(); setStatus('Deine Einträge werden auf diesem Gerät gespeichert.'); }
catch { storageReadable = false; setStatus('Die gespeicherten Daten konnten nicht gelesen werden. Sie wurden nicht überschrieben.'); }
const map = mountMap(root.querySelector<HTMLElement>('#spielkarte')!, () => data.karte, karte => { data.karte = karte; persist(); }, setStatus);
syncFields();
const combatLog = mountCombatLog(root.querySelector<HTMLElement>('#kampfprotokoll')!, referenceTables, () => data.kampfprotokoll, sheet => {
  const previous = data.kampfprotokoll;
  data = parseCharacterData({ ...data, kampfprotokoll: sheet });
  for (const field of fields) {
    const path = field.dataset.path!;
    if ((path === 'kampfprotokoll.ausdauerAktuell' || path === 'kampfprotokoll.kampfstaerke') &&
        getPath({ ...data, kampfprotokoll: previous }, path) !== getPath(data, path)) {
      field.value = String(getPath(data, path));
      field.setCustomValidity('');
      mirror(field);
    }
  }
  persist();
});
combatLog.render();
const combat = mountCombat(root.querySelector<HTMLElement>('#kampfhelfer')!, referenceTables, () => data.kampfprotokoll, value => {
  if (!storageReadable || hasInvalid()) return false;
  try {
    const candidate = parseCharacterData({
      ...data, kampfprotokoll: { ...data.kampfprotokoll, ausdauerAktuell: value },
    });
    saveData(candidate);
    data = candidate;
    syncFields();
    combatLog.syncLatest();
    return true;
  } catch { return false; }
});
function followPanelHash(focus = true): void {
  const hash = location.hash;
  const target = document.getElementById(hash.slice(1));
  const panel = target?.closest<HTMLElement>('.sheet-panel');
  const id = panel?.id ?? 'startseite';
  activate(id);
  if (id === 'kampfhelfer') combat.open();
  if (!focus) return;
  if (target && (panel || hash === '#charakterbogen')) {
    const heading = id === 'kampfhelfer' ? document.getElementById('combat-title') : target;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView();
  } else {
    root!.querySelector<HTMLButtonElement>('[data-tab="startseite"]')!.focus();
    window.scrollTo(0, 0);
  }
}
window.addEventListener('hashchange', () => followPanelHash());
followPanelHash(Boolean(location.hash));

const legacyEntries = root.querySelector<HTMLDetailsElement>('.sheet-legacy')!;
let legacyWasOpen = false;
window.addEventListener('beforeprint', () => {
  legacyWasOpen = legacyEntries.open;
  legacyEntries.open = true;
});
window.addEventListener('afterprint', () => { legacyEntries.open = legacyWasOpen; });

for (const field of fields) field.addEventListener('input', () => {
  const path = field.dataset.path!;
  const endurance = path === 'kampfprotokoll.ausdauerGrundwert' || path === 'kampfprotokoll.ausdauerAktuell';
  const affected = endurance ? fields.filter(item => item.dataset.path === 'kampfprotokoll.ausdauerGrundwert' || item.dataset.path === 'kampfprotokoll.ausdauerAktuell') : [field];
  for (const item of affected) { item.setCustomValidity(''); mirror(item); }
  if (affected.some(item => !item.validity.valid)) { setStatus('Bitte prüfe die markierte Zahl. Ungültige Eingaben werden nicht gespeichert.'); return; }
  const candidate = structuredClone(data);
  for (const item of affected) {
    const value = item instanceof HTMLInputElement && item.type === 'number' && item.value !== '' ? item.valueAsNumber : item.value;
    setPath(candidate, item.dataset.path!, value);
  }
  try {
    data = parseCharacterData(candidate);
    for (const item of affected) {
      const value = String(getPath(data, item.dataset.path!));
      if (item.value === value) continue;
      item.value = value;
      mirror(item);
    }
    updateRank();
    combatLog.syncLatest();
    persist(hasInvalid() ? 'Gespeichert. Bitte prüfe noch ungültige Eingaben.' : undefined);
  } catch (error) {
    const invalid = endurance ? affected.find(item => item.dataset.path === 'kampfprotokoll.ausdauerAktuell')! : field;
    invalid.setCustomValidity(error instanceof Error ? error.message : 'Ungültiger Wert.');
    setStatus(invalid.validationMessage);
  }
});

root.addEventListener('click', event => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
  if (link?.hash && link.hash === location.hash) followPanelHash();
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.tab) {
    const hash = button.dataset.tab === 'startseite' ? '' : '#' + button.dataset.tab;
    if (hash !== location.hash) history.pushState(null, '', location.pathname + location.search + hash);
    followPanelHash(false);
    button.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    return;
  }
  if (button.dataset.action === 'reset') {
    if (!window.confirm('Alle Charakterbogen-Eingaben, Kämpfe und Kartendaten löschen?')) return;
    data = createEmptyData(); storageReadable = true; syncFields(); map.render(); combatLog.render(); persist('Alle Eingaben wurden zurückgesetzt.');
  } else if (button.dataset.action === 'save') {
    if (hasInvalid()) { setStatus('Bitte korrigiere die ungültigen Eingaben vor dem Speichern.'); return; }
    persist('Alle Eingaben wurden gespeichert.');
  } else if (button.dataset.action === 'print') {
    if (hasInvalid()) { setStatus('Bitte korrigiere die ungültigen Eingaben vor dem Drucken.'); return; }
    window.print();
  } else if (button.dataset.action === 'export') {
    if (hasInvalid()) { setStatus('Bitte korrigiere die ungültigen Eingaben vor dem Export.'); return; }
    const url = URL.createObjectURL(new Blob([exportJSON(data)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'einsamer-wolf-charakterbogen.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Charakterbogen als JSON exportiert.');
  } else if (button.dataset.action === 'import') upload.click();
});

upload.addEventListener('change', async () => {
  const file = upload.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Die Datei ist zu groß (maximal 2 MB).');
    const imported = importJSON(await file.text());
    saveData(imported);
    data = imported; storageReadable = true; syncFields(); map.render(); combatLog.render(); setStatus('Charakterbogen importiert und gespeichert.');
  } catch (error) { setStatus(`Import nicht möglich: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`); }
  finally { upload.value = ''; }
});

// Offline-Unterstützung wird nur für den Produktionsbuild registriert.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Die Seite und der lokale Charakterbogen funktionieren auch ohne Service Worker.
    });
  });
}
