import { renderRandomGrid } from './tables.ts';
import { confirmRound, endurance, outcome, previewRound, startFight, strengthDetails, undoRound, type Fight, type Strength } from './combat-state.ts';
import { quotientColumn, quotientRanges, type CombatEffect, type ReferenceTables } from './table-model.ts';
import type { CharacterData } from './state.ts';

const signed = (value: number): string => value >= 0 ? `+${value}` : String(value);
const effectLabel = (effect: CombatEffect): string => effect.death ? 'T (Tod)' : effect.original;
const statuses = {
  active: 'Kampf läuft.',
  victory: 'Sieg. Der Gegner ist tot.',
  defeat: 'Niederlage. Einsamer Wolf ist tot.',
  both: 'Einsamer Wolf und der Gegner sind tot.',
  stopped: 'Kampf beendet · Flucht / Sonderregel.',
};

export function renderCombat(tables: ReferenceTables): string {
  return `<section class="sheet-panel rules-panel combat-helper no-print" id="kampfhelfer" aria-labelledby="combat-title" hidden>
    <h2 id="combat-title" tabindex="-1">Kampfhelfer</h2>
    <p><a href="#rules-kampf">Kampfregeln</a> · <a href="#rules-kampfresultate">Kampfresultat-Tabelle</a></p>
    <form aria-label="Kampf vorbereiten">
      <div class="combat-sides">
        <fieldset><legend>Einsamer Wolf</legend>
          <label>Basis-Kampfstärke <input name="base" type="number" min="0" step="1" required></label>
          <label>Aktuelle Ausdauer <input name="wolf" type="number" min="0" step="1" required></label>
          <p data-combat="max"></p>
          <p data-combat="wolf-now" hidden></p>
        </fieldset>
        <fieldset><legend>Gegner</legend>
          <label>Name (optional) <input name="enemy-name" maxlength="100"></label>
          <label>Kampfstärke <input name="enemy-strength" type="number" min="0" step="1" required></label>
          <label>Aktuelle Ausdauer <input name="enemy" type="number" min="0" step="1" required></label>
          <p data-combat="enemy-now" hidden></p>
        </fieldset>
      </div>
      <fieldset><legend>Kampfstärke-Modifikatoren</legend>
        <label>Geführte Waffe <select name="weapon">
          <option value="">Bitte auswählen</option>
          <option value="unarmed">Waffenlos (−4)</option>
          <option value="other">Waffe ohne passende Waffenkunde (0)</option>
          <option value="matching">Waffe mit passender Waffenkunde (+2)</option>
        </select></label>
        <label><input name="mindblast" type="checkbox"> Gedankenstrahl bei nicht immunem Gegner (+2)</label>
        <label>Zusätzlicher Modifikator laut Abenteuer <input name="adventure" type="number" step="1" value="0"></label>
      </fieldset>
      <p data-combat="quotient" aria-live="polite"></p>
      <button type="submit" data-combat="start">Kampf beginnen</button>
    </form>
    <p data-combat="status" role="status"></p>
    <div data-combat="fight" hidden>
      <div data-combat="round">
        <label>Zufallszahl (0–9) <input name="random" type="number" min="0" max="9" step="1"></label>
        <details><summary>Aus der Zufallszahlen-Tabelle auswählen</summary>
          ${renderRandomGrid(tables)}
        </details>
        <p data-combat="preview" aria-live="polite"></p>
        <button type="button" data-combat="confirm" disabled>Kampfrunde übernehmen</button>
        <button type="button" data-combat="stop">Flucht / Sonderregel</button>
      </div>
      <h3>Bestätigte Kampfrunden</h3>
      <ol data-combat="log"></ol>
      <div class="combat-actions">
        <button type="button" data-combat="undo">Letzte Runde rückgängig machen</button>
        <button type="button" data-combat="save">Ausdauer ins Aktionsblatt übernehmen</button>
        <button type="button" data-combat="restart">Neuen Kampf vorbereiten</button>
      </div>
    </div>
  </section>`;
}

export function mountCombat(root: HTMLElement, tables: ReferenceTables, readSheet: () => CharacterData['kampfprotokoll'],
  saveEndurance: (value: number) => boolean) {
  const element = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-combat="${name}"]`)!;
  const input = (name: string) => root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const weapon = root.querySelector<HTMLSelectElement>('select[name="weapon"]')!;
  const form = root.querySelector('form')!;
  const random = input('random');
  const status = element('status');
  function clearRandomSelection(): void {
    root.querySelector('[data-random-row][aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
  }
  const confirm = element<HTMLButtonElement>('confirm');
  let fight: Fight | undefined;
  let initialized = false;

  function loadSheet(): void {
    if (fight) return;
    const sheet = readSheet();
    input('base').value = String(sheet.kampfstaerke);
    input('wolf').value = String(sheet.ausdauerAktuell);
    input('wolf').max = String(sheet.ausdauerGrundwert);
    element('max').textContent = sheet.ausdauerGrundwert === '' ? '' : `Start-/Maximalausdauer ${sheet.ausdauerGrundwert}`;
    initialized = true;
    render();
  }

  function readStrength() {
    if (!input('base').validity.valid || !input('enemy-strength').validity.valid) throw new Error('Bitte beide Kampfstärken als ganze Zahlen ab 0 eingeben.');
    if (!weapon.value) throw new Error('Bitte angeben, welche Waffe geführt wird.');
    return strengthDetails({
      base: input('base').valueAsNumber,
      enemy: input('enemy-strength').valueAsNumber,
      weapon: weapon.value as Strength['weapon'],
      mindblast: input('mindblast').checked,
      adventure: input('adventure').value === '' && !input('adventure').validity.badInput ? 0 : input('adventure').valueAsNumber,
    });
  }

  function preview(): void {
    const summary = element('quotient');
    const output = element('preview');
    confirm.disabled = true;
    output.textContent = '';
    let strength;
    try {
      strength = readStrength();
    } catch (error) {
      summary.textContent = error instanceof Error ? error.message : '';
      return;
    }
    const range = quotientRanges[quotientColumn(strength.quotient)];
    summary.textContent = `Effektive Kampfstärke ${strength.effective} (Waffe ${signed(strength.weapon)}, Gedankenstrahl ${signed(strength.mindblast)}, Abenteuer ${signed(Number(input('adventure').value))}). Kampfquotient ${strength.quotient} (${range.label}).`;
    if (!fight || outcome(fight) !== 'active' || (!random.value && !random.validity.badInput)) return;
    if (!random.validity.valid) {
      output.textContent = 'Bitte eine ganze Zufallszahl von 0 bis 9 eingeben.';
      return;
    }
    const round = previewRound(fight, strength.quotient, random.valueAsNumber, tables);
    output.textContent = `Vorschau · Einsamer Wolf ${effectLabel(round.result.loneWolf)} → ${round.after.wolf} AU · Gegner ${effectLabel(round.result.enemy)} → ${round.after.enemy} AU.`;
    confirm.disabled = false;
  }

  function render(): void {
    element('fight').hidden = !fight;
    element('start').hidden = Boolean(fight);
    for (const name of ['wolf', 'enemy', 'enemy-name']) input(name).readOnly = Boolean(fight);
    for (const name of ['wolf', 'enemy']) input(name).closest('label')!.hidden = Boolean(fight);
    element('wolf-now').hidden = !fight;
    element('enemy-now').hidden = !fight;
    if (fight) {
      const remaining = endurance(fight);
      element('wolf-now').textContent = `Aktuelle Ausdauer ${remaining.wolf}`;
      element('enemy-now').textContent = `Aktuelle Ausdauer ${remaining.enemy}`;
      element('round').hidden = outcome(fight) !== 'active';
      status.textContent = statuses[outcome(fight)];
      element<HTMLButtonElement>('undo').disabled = !fight.rounds.length;
      element<HTMLButtonElement>('save').disabled = remaining.wolf === readSheet().ausdauerAktuell;
      const entries = fight.rounds.map(round => {
        const li = document.createElement('li');
        li.textContent = `KQ ${round.quotient} · Zufallszahl ${round.random} · EW ${effectLabel(round.result.loneWolf)} (${round.before.wolf} → ${round.after.wolf} AU) · F ${effectLabel(round.result.enemy)} (${round.before.enemy} → ${round.after.enemy} AU)`;
        return li;
      });
      element('log').replaceChildren(...entries);
    }
    preview();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (fight) return;
    try {
      readStrength();
      fight = startFight({ wolf: input('wolf').valueAsNumber, enemy: input('enemy').valueAsNumber });
      render();
      if (outcome(fight) === 'active') random.focus();
    } catch (error) {
      if (error instanceof Error) status.textContent = error.message;
    }
  });
  random.addEventListener('input', clearRandomSelection);
  root.addEventListener('input', preview);
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button || !fight) return;
    if (button.dataset.randomRow !== undefined && outcome(fight) === 'active') {
      random.value = String(tables.selectRandomNumber(Number(button.dataset.randomRow), Number(button.dataset.randomColumn)).value);
      for (const cell of root.querySelectorAll('[data-random-row]')) cell.setAttribute('aria-pressed', String(cell === button));
      preview();
      return;
    }
    switch (button.dataset.combat) {
      case 'confirm':
        if (confirm.disabled) return;
        fight = confirmRound(fight, readStrength().quotient, random.valueAsNumber, tables);
        random.value = '';
        clearRandomSelection();
        render();
        if (outcome(fight) === 'active') random.focus();
        break;
      case 'undo':
        fight = undoRound(fight);
        random.value = '';
        clearRandomSelection();
        render();
        break;
      case 'stop':
        fight = { ...fight, stopped: true };
        random.value = '';
        clearRandomSelection();
        render();
        break;
      case 'restart':
        if (!window.confirm('Diesen Kampf und sein Rundenprotokoll verwerfen und einen neuen Kampf vorbereiten?')) return;
        fight = undefined;
        form.reset();
        random.value = '';
        clearRandomSelection();
        status.textContent = '';
        loadSheet();
        input('enemy-name').focus();
        break;
      case 'save': {
        const value = endurance(fight).wolf;
        const current = readSheet().ausdauerAktuell;
        if (!window.confirm(`Aktuelle Ausdauer im Aktionsblatt von ${current === '' ? 'leer' : current} auf ${value} setzen?`)) return;
        if (saveEndurance(value)) {
          render();
          status.textContent += ' Ausdauer im Aktionsblatt gespeichert.';
        } else {
          status.textContent = 'Die Ausdauer konnte im Aktionsblatt nicht gespeichert werden. Bitte prüfe den Grundwert und den Browserspeicher.';
        }
        break;
      }
    }
  });
  return { open: () => { if (initialized) render(); else loadSheet(); } };
}
