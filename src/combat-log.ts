import { addLoggedRound, changeStrength, correctRound, logStatus, newLoggedFight, type LoggedFight, type LoggedRound } from './combat-log-state.ts';
import type { CharacterData } from './state.ts';
import type { ReferenceTables } from './table-model.ts';

const sides = [['wolf', 'Einsamer Wolf'], ['enemy', 'Feind']] as const;
type Side = typeof sides[number][0];

function field(name: string, label: string, value: number | null, attributes = ''): string {
  const type = name.startsWith('loss-') ? 'text' : 'number';
  const display = value === null ? 'T' : value;
  return `<label>${label}<input name="${name}" type="${type}" step="1" ${attributes} value="${display}" required></label>`;
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
    ${field('current-' + side, `Aktuelle AP · ${label}`, fight.current[side], 'min="0"')}
    ${field('strength-' + side, `KS · ${label}`, fight.strength[side])}
  </fieldset>`);
  const status = logStatus(fight);
  return `<section class="combat-log-fight sheet-box" data-fight="${index}" aria-labelledby="logged-fight-${index}">
    <h3 id="logged-fight-${index}">Kampf ${index + 1}</h3>
    <div class="combat-log-values">
      ${wolf}
      ${field('quotient', 'Kampfquotient (KQ)', fight.quotient)}
      ${enemy}
    </div>
    <p data-fight-status role="status">${status || 'Kampf läuft.'}</p>
    <button type="button" data-new-round ${status ? 'disabled' : ''}>Neue Runde</button>
    <div data-fight-rounds>${fight.rounds.map(renderRound).join('')}</div>
    <p data-fight-error role="alert" hidden></p>
  </section>`;
}

export function mountCombatLog(root: HTMLElement, tables: ReferenceTables, read: () => CharacterData['kampfprotokoll'],
  save: () => void) {
  const list = root.querySelector<HTMLElement>('[data-fights]')!;

  function sync(card: HTMLElement, fight: LoggedFight): void {
    const status = logStatus(fight);
    card.querySelector<HTMLElement>('[data-fight-status]')!.textContent = status || 'Kampf läuft.';
    card.querySelector<HTMLButtonElement>('[data-new-round]')!.disabled = Boolean(status);
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
    const fight = read().kaempfe[Number(card.dataset.fight)];
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
      showError(card, '');
      save();
    } catch (error) {
      showError(card, error instanceof Error ? error.message : 'Die Korrektur ist ungültig.');
    }
    sync(card, fight);
  });

  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button?.hasAttribute('data-new-fight')) {
      const sheet = read();
      const fight = newLoggedFight(sheet.ausdauerAktuell || 0, sheet.kampfstaerke || 0);
      sheet.kaempfe.push(fight);
      list.insertAdjacentHTML('beforeend', renderLoggedFight(fight, sheet.kaempfe.length - 1));
      list.lastElementChild?.querySelector<HTMLInputElement>('[name="current-wolf"]')?.focus();
      save();
    } else if (button?.hasAttribute('data-new-round')) {
      const card = button.closest<HTMLElement>('[data-fight]')!;
      const fight = read().kaempfe[Number(card.dataset.fight)];
      const index = fight.rounds.length;
      if (logStatus(fight)) return;
      addLoggedRound(fight, tables);
      card.querySelector('[data-fight-rounds]')!.insertAdjacentHTML('beforeend', renderRound(fight.rounds[index], index));
      sync(card, fight);
      showError(card, '');
      if (button.disabled) card.querySelector<HTMLInputElement>(`[data-round="${index}"] input`)?.focus();
      save();
    }
  });

  return { render: () => { list.innerHTML = read().kaempfe.map(renderLoggedFight).join(''); } };
}
