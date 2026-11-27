import { quotientColumn, quotientRanges, type CombatEffect, type RandomSelection, type ReferenceTables } from './table-model.ts';

const display = (effect: CombatEffect): string => effect.death ? 'T' : effect.original.replace('-', '−');
const explanation = (effect: CombatEffect): string => effect.death ? 'Tod (T)' : `${effect.loss} Ausdauerpunkte Verlust`;
export function renderRandomGrid(tables: ReferenceTables): string {
  return `<div class="rules-table random-scroll" tabindex="0" role="region" aria-label="Zufallszahlenraster, horizontal scrollbar">
      <table class="random-table"><caption>Zufallszahlen in Originalreihenfolge</caption><tbody>${tables.random.map((row, r) => `<tr>${row.map((n, c) => `<td><button type="button" data-random-row="${r}" data-random-column="${c}" aria-label="Zeile ${r + 1}, Spalte ${c + 1}: ${n}" aria-pressed="false">${n}</button></td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>`;
}
export function renderTables(tables: ReferenceTables): string {
  return `<section class="sheet-panel rules-panel" id="kampfresultate" aria-labelledby="rules-kampfresultate" hidden>
    <h2 id="rules-kampfresultate" tabindex="-1">Kampfresultat-Tabelle</h2>
    <p><strong>F = Feind · EW = Einsamer Wolf · T = Tod.</strong> Negative Zahlen sind Ausdauerverluste; −0 bedeutet keinen Verlust. T bedeutet unmittelbaren Tod.</p>
    <p>Die zusammengeführte Gesamt-Resultat-Tabelle ist die Datenquelle. Das Nachschlagen verändert weder Ausdauer noch Spielstand.</p>
    <form class="combat-lookup" aria-label="Kampfresultat nachschlagen">
      <label>Kampfquotient <input name="quotient" type="number" step="1" value="0" required></label>
      <label>Zufallszahl <select name="random">${Array.from({ length: 10 }, (_, n) => `<option value="${n}">${n}</option>`).join('')}</select></label>
      <button type="submit">Nachschlagen</button>
    </form>
    <p class="combat-result rules-notice" role="status" aria-live="polite" aria-atomic="true"></p>
    <p id="combat-scroll-help">Die Tabelle lässt sich seitlich verschieben, mit Tastatur nach Fokussieren auch über die Pfeiltasten. Die ausgewählte Zeile und Spalte sind hervorgehoben.</p>
    <div class="rules-table combat-scroll" tabindex="0" role="region" aria-label="Kampfresultate, horizontal scrollbar" aria-describedby="combat-scroll-help">
      <table class="combat-table"><caption>Ausdauerverluste nach Kampfquotient und Zufallszahl</caption>
        <thead><tr><th scope="col">Zufallszahl</th>${quotientRanges.map((range, column) => `<th scope="col" data-column="${column}">${range.label}</th>`).join('')}</tr></thead>
        <tbody>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => `<tr data-random="${n}"><th scope="row">${n}</th>${tables.combat[n].map((result, column) => `<td data-column="${column}"><span>F: ${display(result.enemy)}</span><span>EW: ${display(result.loneWolf)}</span></td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div><a href="#rules-zufallszahlen">Zur Zufallszahlen-Tabelle</a> · <a href="#rules-title">Zum Regelhandbuch</a>
  </section>
  <section class="sheet-panel rules-panel" id="zufallszahlen" aria-labelledby="rules-zufallszahlen" hidden>
    <h2 id="rules-zufallszahlen" tabindex="-1">Zufallszahlen-Tabelle</h2>
    <p>Das Originalraster enthält zehn Zeilen und zehn Spalten. Tippe ein Feld an, um dessen Ziffer für das Nachschlagen in der Kampfresultat-Tabelle auszuwählen. Auch dasselbe Feld kann erneut gewählt werden.</p>
    ${renderRandomGrid(tables)}
    <p class="random-selection rules-notice" role="status" aria-live="polite" aria-atomic="true">Noch kein Feld ausgewählt.</p>
    <a href="#rules-kampfresultate">Zum Kampfergebnis</a> · <a href="#rules-title">Zum Regelhandbuch</a>
  </section>`;
}
/** Optional callback and bubbling event provide a repeatable selection interface for future helpers. */
export function mountTables(root: HTMLElement, tables: ReferenceTables, onSelect?: (selection: RandomSelection) => void): void {
  const form = root.querySelector<HTMLFormElement>('.combat-lookup')!;
  const quotient = form.elements.namedItem('quotient') as HTMLInputElement;
  const random = form.elements.namedItem('random') as HTMLSelectElement;
  const output = root.querySelector<HTMLElement>('.combat-result')!;
  function lookup(): void {
    const valid = quotient.checkValidity() && Number.isSafeInteger(quotient.valueAsNumber);
    const column = valid ? quotientColumn(quotient.valueAsNumber) : -1;
    for (const cell of root.querySelectorAll<HTMLElement>('[data-column]')) cell.classList.toggle('selected-column', valid && Number(cell.dataset.column) === column);
    for (const row of root.querySelectorAll<HTMLElement>('tr[data-random]')) row.classList.toggle('selected-row', valid && Number(row.dataset.random) === Number(random.value));
    if (!valid) { output.textContent = 'Bitte einen ganzzahligen Kampfquotienten eingeben.'; return; }
    const result = tables.getCombatResult(quotient.valueAsNumber, Number(random.value));
    output.textContent = `Kampfquotient ${quotient.valueAsNumber} (${quotientRanges[column].label}), Zufallszahl ${random.value}: F (Feind): ${explanation(result.enemy)}; EW (Einsamer Wolf): ${explanation(result.loneWolf)}.`;
  }
  form.addEventListener('submit', event => { event.preventDefault(); lookup(); });
  quotient.addEventListener('input', lookup);
  random.addEventListener('change', lookup);
  root.querySelector<HTMLElement>('.random-table')!.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-random-row]');
    if (!button) return;
    const selection = tables.selectRandomNumber(Number(button.dataset.randomRow), Number(button.dataset.randomColumn));
    for (const field of root.querySelectorAll<HTMLButtonElement>('[data-random-row]')) field.setAttribute('aria-pressed', String(field === button));
    random.value = String(selection.value);
    root.querySelector<HTMLElement>('.random-selection')!.textContent = `Ausgewählt: ${selection.value} · Zeile ${selection.row + 1}, Spalte ${selection.column + 1}.`;
    lookup();
    onSelect?.(selection);
    root.dispatchEvent(new CustomEvent<RandomSelection>('random-number-selected', { detail: selection, bubbles: true }));
  });
  lookup();
}
