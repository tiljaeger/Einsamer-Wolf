import { addLoggedRound, changeStrength, correctRound, isFinishedFight, logStatus, newLoggedFight, rollLoggedRound, type LoggedFight, type LoggedRound } from './combat-log-state.ts';
import { readLoggedFight, type CharacterData } from './state.ts';
import type { ReferenceTables } from './table-model.ts';

const sides = [['wolf', 'Einsamer Wolf'], ['enemy', 'Feind']] as const;
type Side = typeof sides[number][0];

function field(name: string, label: string, value: number | null, attributes = '', accessibleLabel = label): string {
  const type = name.startsWith('loss-') ? 'text' : 'number';
  const display = value === null ? 'T' : value;
  return `<label>${label}<input name="${name}" type="${type}" step="1" aria-label="${accessibleLabel}" ${attributes} value="${display}" required></label>`;
}

function renderRound(round: LoggedRound, index: number): string {
  return `<fieldset class="combat-log-round" data-round="${index}">
    <legend>Runde ${index + 1}</legend>
    ${field('random', 'Zufallszahl', round.random, 'min="0" max="9"')}
    ${field('quotient', 'KQ der Runde', round.quotient)}
    ${sides.map(([side, label]) => `
      ${field('loss-' + side, `Verlust ${label} (AP/T)`, round.losses[side])}
      ${field('after-' + side, `AP danach · ${label}`, round.after[side], 'min="0"')}
    `).join('')}
  </fieldset>`;
}

export function renderLoggedFight(fight: LoggedFight, index: number): string {
  const [wolf, enemy] = sides.map(([side, label]) => `<fieldset>
    <legend>${label}</legend>
    ${field('current-' + side, 'Ausdauerpunkte', fight.current[side], 'min="0"', `Aktuelle AP · ${label}`)}
    ${field('strength-' + side, 'Kampfstärke', fight.strength[side], '', `KS · ${label}`)}
  </fieldset>`);
  const status = logStatus(fight);
  return `<section class="combat-log-fight sheet-box" data-fight="${index}" aria-labelledby="logged-fight-${index}">
    <h3 id="logged-fight-${index}">Kampf ${index + 1}</h3>
    <div class="combat-log-values">
      ${wolf}
      <div class="combat-log-random">
        <span id="logged-random-${index}">Zufallszahl</span>
        <output data-pending-random aria-labelledby="logged-random-${index}">${fight.pendingRandom ?? '–'}</output>
      </div>
      ${field('quotient', 'Kampfquotient (KQ)', fight.quotient)}
      ${enemy}
    </div>
    <p data-fight-status role="status">${status || 'Kampf läuft.'}</p>
    <div class="combat-actions">
      <button type="button" data-roll-round ${isFinishedFight(fight) ? 'disabled' : ''}>Würfeln</button>
      <button type="button" data-new-round ${status ? 'disabled' : ''}>Neue Runde</button>
    </div>
    <div data-fight-rounds>${fight.rounds.map(renderRound).join('')}</div>
    <p data-fight-error role="alert" hidden></p>
  </section>`;
}

export function mountCombatLog(root: HTMLElement, tables: ReferenceTables, read: () => CharacterData['kampfprotokoll'],
  save: (sheet: CharacterData['kampfprotokoll']) => void, clear: () => void) {
  const list = root.querySelector<HTMLElement>('[data-fights]')!;
  const past = root.querySelector<HTMLElement>('[data-past-fights]')!;
  const history = root.querySelector<HTMLDetailsElement>('.sheet-fight-history')!;
  const emptyHistory = root.querySelector<HTMLElement>('[data-empty-history]')!;
  const message = root.querySelector<HTMLElement>('[data-combat-log-message]')!;
  const clearButton = root.querySelector<HTMLButtonElement>('[data-clear-fights]')!;

  function setMessage(text: string): void {
    message.hidden = !text;
    message.textContent = text;
  }

  function updateControls(): void {
    const sheet = read();
    emptyHistory.hidden = past.childElementCount > 0;
    clearButton.disabled = sheet.kaempfe.length === 0 &&
      !sheet.kampfrunden.some(round => Object.values(round).some(value => value !== ''));
  }

  function placeLatest(card: HTMLElement, fight: LoggedFight): void {
    const finished = isFinishedFight(fight);
    const destination = finished ? past : list;
    card.querySelector<HTMLElement>('.combat-actions')!.hidden = finished;
    if (card.parentElement === destination) return;
    const hadFocus = card.contains(document.activeElement);
    destination.append(card);
    if (hadFocus) {
      const focusTarget = finished ? history.querySelector('summary') : card.querySelector('input');
      focusTarget?.focus();
    }
  }

  function render(): void {
    setMessage('');
    const sheet = read();
    const latest = sheet.kaempfe.length - 1;
    list.innerHTML = latest < 0 ? '' : renderLoggedFight(readLoggedFight(sheet, latest), latest);
    past.innerHTML = sheet.kaempfe.slice(0, -1).map((fight, index) => renderLoggedFight(fight, index)).join('');
    for (const actions of past.querySelectorAll<HTMLElement>('.combat-actions')) actions.hidden = true;
    const card = list.firstElementChild as HTMLElement | null;
    if (card) placeLatest(card, readLoggedFight(sheet, latest));
    updateControls();
  }

  function syncLatest(): void {
    const sheet = read();
    const index = sheet.kaempfe.length - 1;
    const card = root.querySelector<HTMLElement>(`[data-fight="${index}"]`);
    if (card) {
      const fight = readLoggedFight(sheet, index);
      placeLatest(card, fight);
      sync(card, fight);
    }
    updateControls();
  }

  function sync(card: HTMLElement, fight: LoggedFight): void {
    const status = logStatus(fight);
    card.querySelector<HTMLElement>('[data-fight-status]')!.textContent = status || 'Kampf läuft.';
    card.querySelector<HTMLButtonElement>('[data-new-round]')!.disabled = Boolean(status);
    card.querySelector<HTMLButtonElement>('[data-roll-round]')!.disabled = isFinishedFight(fight);
    card.querySelector<HTMLOutputElement>('[data-pending-random]')!.value = String(fight.pendingRandom ?? '–');
    for (const input of card.querySelectorAll<HTMLInputElement>('input')) {
      const row = input.closest<HTMLElement>('[data-round]');
      const [name, side] = input.name.split('-') as [string, Side];
      let value: number | null;
      if (row) {
        const round = fight.rounds[Number(row.dataset.round)];
        if (name === 'loss') value = round.losses[side];
        else if (name === 'after') value = round.after[side];
        else value = name === 'random' ? round.random : round.quotient;
      } else if (name === 'current') value = fight.current[side];
      else if (name === 'strength') value = fight.strength[side];
      else value = fight.quotient;
      const display = value === null ? 'T' : String(value);
      if (input.value !== display) input.value = display;
    }
  }

  function showError(card: HTMLElement, message: string): void {
    const error = card.querySelector<HTMLElement>('[data-fight-error]')!;
    error.hidden = !message;
    error.textContent = message;
  }

  root.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const card = input.closest<HTMLElement>('[data-fight]');
    if (!card) return;
    const sheet = structuredClone(read());
    const index = Number(card.dataset.fight);
    const fight = readLoggedFight(sheet, index);
    const wasFinished = isFinishedFight(fight);
    const before = { ap: fight.current.wolf, ks: fight.strength.wolf };
    const row = input.closest<HTMLElement>('[data-round]');
    const [name, side] = input.name.split('-') as [string, Side];
    const isLoss = name === 'loss';
    const raw = input.value.trim();
    const value = isLoss ? (raw.toUpperCase() === 'T' ? null : /^\d+$/.test(raw) ? Number(raw) : NaN) : input.valueAsNumber;

    try {
      if (!input.validity.valid || (value !== null && !Number.isSafeInteger(value))) {
        throw new Error(isLoss ? 'Bitte einen Verlust als ganze Zahl ab 0 oder T (Tod) eingeben.' : 'Bitte eine gültige ganze Zahl eingeben.');
      }
      if (row) {
        correctRound(fight, Number(row.dataset.round), name as Parameters<typeof correctRound>[2], value, side, tables);
      } else if (value !== null) {
        if (name === 'strength') changeStrength(fight, side, value);
        else if (name === 'current') {
          if (value > 0 && fight.rounds.at(-1)?.losses[side] === null) {
            throw new Error('Ändere zuerst das Todesresultat T der letzten Runde.');
          }
          fight.current[side] = value;
        } else fight.quotient = value;
      }
      sheet.kaempfe[index] = fight;
      if (index === sheet.kaempfe.length - 1 && (!wasFinished || !isFinishedFight(fight))) {
        if (fight.current.wolf !== before.ap || (!row && name === 'current' && side === 'wolf')) {
          sheet.ausdauerAktuell = fight.current.wolf;
        }
        if (fight.strength.wolf !== before.ks || (!row && name === 'strength' && side === 'wolf')) {
          sheet.kampfstaerke = fight.strength.wolf;
        }
      }
      save(sheet);
      showError(card, '');
    } catch (error) {
      showError(card, error instanceof Error ? error.message : 'Die Korrektur ist ungültig.');
    }
    if (index === read().kaempfe.length - 1) syncLatest();
    else sync(card, readLoggedFight(read(), index));
  });

  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button?.hasAttribute('data-new-fight')) {
      const sheet = structuredClone(read());
      const previous = sheet.kaempfe.length - 1;
      if (previous >= 0) sheet.kaempfe[previous] = readLoggedFight(sheet, previous);
      const fight = newLoggedFight(sheet.ausdauerAktuell || 0, sheet.kampfstaerke || 0);
      sheet.kaempfe.push(fight);
      save(sheet);
      render();
      list.lastElementChild?.querySelector<HTMLInputElement>('[name="current-wolf"]')?.focus();
    } else if (button === clearButton) {
      if (!window.confirm('Alle Kämpfe und manuellen Kampfeinträge endgültig löschen?')) return;
      try {
        clear();
      } catch {
        setMessage('Die Kämpfe konnten nicht gelöscht werden. Bitte prüfe den Browserspeicher.');
        return;
      }
      history.open = false;
      render();
      setMessage('Alle Kämpfe wurden gelöscht.');
      root.querySelector<HTMLButtonElement>('[data-new-fight]')!.focus();
    } else if (button?.hasAttribute('data-roll-round') && list.contains(button)) {
      const card = button.closest<HTMLElement>('[data-fight]')!;
      const index = Number(card.dataset.fight);
      const sheet = structuredClone(read());
      const fight = readLoggedFight(sheet, index);
      try {
        const digit = rollLoggedRound(fight);
        sheet.kaempfe[index].pendingRandom = digit;
        save(sheet);
        card.querySelector<HTMLOutputElement>('[data-pending-random]')!.value = String(digit);
        showError(card, '');
      } catch (error) {
        showError(card, error instanceof Error ? error.message : 'Die Zufallszahl konnte nicht gespeichert werden.');
      }
    } else if (button?.hasAttribute('data-new-round') && list.contains(button)) {
      const card = button.closest<HTMLElement>('[data-fight]')!;
      const fightIndex = Number(card.dataset.fight);
      const sheet = structuredClone(read());
      const fight = readLoggedFight(sheet, fightIndex);
      const roundIndex = fight.rounds.length;
      if (logStatus(fight)) return;
      try {
        addLoggedRound(fight, tables);
        sheet.kaempfe[fightIndex] = fight;
        if (fightIndex === sheet.kaempfe.length - 1) sheet.ausdauerAktuell = fight.current.wolf;
        save(sheet);
      } catch (error) {
        showError(card, error instanceof Error ? error.message : 'Die Runde konnte nicht erfasst werden.');
        return;
      }
      card.querySelector('[data-fight-rounds]')!.insertAdjacentHTML('beforeend', renderRound(fight.rounds[roundIndex], roundIndex));
      const status = logStatus(fight);
      if (status) {
        setMessage(status);
        syncLatest();
        history.querySelector('summary')?.focus();
      } else {
        sync(card, fight);
      }
      showError(card, '');
    }
  });

  return { render, syncLatest };
}
