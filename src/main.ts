import './style.css';
import './sheet.css';
import { renderForms } from './forms';
import { createEmptyData, exportJSON, importJSON, loadData, parseCharacterData, saveData, type CharacterData } from './state';

const root = document.querySelector<HTMLElement>('#sheet-root');
if (!root) throw new Error('Der Charakterbogen konnte nicht initialisiert werden.');
root.innerHTML = `
  <div class="sheet-controls">
    <p class="sheet-kicker">DEIN ABENTEUER · DEIN CHARAKTER</p>
    <h2 id="sheet-app-title">Dein Charakterbogen</h2>
    <p>Deine Einträge bleiben in diesem Browser auf diesem Gerät gespeichert. Sichere sie zusätzlich als Datei.</p>
    <div class="sheet-tabs" aria-label="Formularseite auswählen">
      <button type="button" data-tab="aktionsblatt" aria-pressed="true">Aktionsblatt</button>
      <button type="button" data-tab="kampfprotokoll" aria-pressed="false">Kampfprotokoll</button>
    </div>
    <div class="sheet-actions">
      <button type="button" data-action="save">Speichern</button>
      <button type="button" data-action="reset">Zurücksetzen</button>
      <button type="button" data-action="print">PDF erstellen</button>
      <button type="button" data-action="export">Daten exportieren</button>
      <button type="button" data-action="import">Daten importieren</button>
      <input class="sheet-file" type="file" accept="application/json,.json" aria-label="JSON-Datei zum Import auswählen" hidden>
    </div>
    <p class="sheet-status" role="status" aria-live="polite"></p>
  </div>
  <div class="sheet-pages">${renderForms()}</div>`;

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
function syncFields(): void {
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
  for (const button of root!.querySelectorAll<HTMLButtonElement>('[data-tab]')) button.setAttribute('aria-pressed', String(button.dataset.tab === id));
}

try { data = loadData(); setStatus('Deine Einträge werden auf diesem Gerät gespeichert.'); }
catch { storageReadable = false; setStatus('Die gespeicherten Daten konnten nicht gelesen werden. Sie wurden nicht überschrieben.'); }
syncFields();
activate('aktionsblatt');

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
    persist(hasInvalid() ? 'Gespeichert. Bitte prüfe noch ungültige Eingaben.' : undefined);
  } catch (error) {
    const invalid = endurance ? affected.find(item => item.dataset.path === 'kampfprotokoll.ausdauerAktuell')! : field;
    invalid.setCustomValidity(error instanceof Error ? error.message : 'Ungültiger Wert.');
    setStatus(invalid.validationMessage);
  }
});

root.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.tab) { activate(button.dataset.tab); return; }
  if (button.dataset.action === 'reset') {
    if (!window.confirm('Alle Eingaben auf beiden Seiten löschen?')) return;
    data = createEmptyData(); storageReadable = true; syncFields(); persist('Alle Eingaben wurden zurückgesetzt.');
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
    data = imported; storageReadable = true; syncFields(); setStatus('Charakterbogen importiert und gespeichert.');
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
