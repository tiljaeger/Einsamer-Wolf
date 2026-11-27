import { outcome, previewRound, remaining, startFight, type Endurance } from './combat-state.ts';
import type { ReferenceTables } from './table-model.ts';

type Side = keyof Endurance;
type Loss = number | null;

export interface LoggedRound {
  quotient: number;
  random: number;
  losses: Record<Side, Loss>;
  before: Endurance;
  after: Endurance;
}

export interface LoggedFight {
  strength: Endurance;
  quotient: number;
  current: Endurance;
  rounds: LoggedRound[];
}

export function newLoggedFight(wolfAP: number, wolfKS: number): LoggedFight {
  return {
    strength: { wolf: wolfKS, enemy: 0 },
    quotient: wolfKS,
    current: { wolf: wolfAP, enemy: 0 },
    rounds: [],
  };
}

export function changeStrength(fight: LoggedFight, side: Side, value: number): void {
  if (fight.strength[side] === value) return;
  const strength = { ...fight.strength, [side]: value };
  const quotient = strength.wolf - strength.enemy;
  if (!Number.isSafeInteger(quotient)) throw new Error('Der berechnete Kampfquotient ist zu groß.');
  fight.strength = strength;
  fight.quotient = quotient;
}

export function logStatus(fight: LoggedFight): string {
  const last = fight.rounds.at(-1);
  if (!last && (fight.current.enemy === 0 || fight.current.wolf === 0)) {
    return 'Noch keine Runde. Beide Seiten benötigen mindestens 1 AP.';
  }
  const current = { ...fight.current };
  if (last?.losses.wolf === null) current.wolf = 0;
  if (last?.losses.enemy === null) current.enemy = 0;
  return {
    active: '',
    victory: 'Kampf beendet. Der Feind ist tot.',
    defeat: 'Kampf beendet. Einsamer Wolf ist tot.',
    both: 'Kampf beendet. Beide Seiten sind tot.',
    stopped: 'Kampf beendet.',
  }[outcome(startFight(current))];
}

export function isFinishedFight(fight: LoggedFight): boolean {
  return fight.rounds.length > 0 && Boolean(logStatus(fight));
}

export function addLoggedRound(fight: LoggedFight, tables: ReferenceTables, random = Math.floor(Math.random() * 10)): void {
  if (logStatus(fight)) throw new Error('Für diesen Kampf ist keine weitere Runde möglich.');
  const { quotient, before, after, result } = previewRound(startFight(fight.current), fight.quotient, random, tables);
  fight.rounds.push({ quotient, random, before, after, losses: { wolf: result.loneWolf.loss, enemy: result.enemy.loss } });
  fight.current = { ...after };
}

export function correctRound(fight: LoggedFight, index: number, field: 'quotient' | 'random' | 'loss' | 'after',
  value: Loss, side: Side, tables: ReferenceTables): void {
  const round = fight.rounds[index];
  if (field === 'quotient' || field === 'random') {
    if (value === null || value === round[field]) return;
    round[field] = value;
    const result = tables.getCombatResult(round.quotient, round.random);
    round.losses = { wolf: result.loneWolf.loss, enemy: result.enemy.loss };
    round.after = {
      wolf: remaining(round.before.wolf, round.losses.wolf),
      enemy: remaining(round.before.enemy, round.losses.enemy),
    };
    if (index === fight.rounds.length - 1) fight.current = { ...round.after };
  } else {
    if (field === 'loss') {
      if (round.losses[side] === value) return;
      round.losses[side] = value;
      round.after[side] = remaining(round.before[side], value);
    } else {
      if (value === null || (round.losses[side] === null && value !== 0)) {
        throw new Error('Ändere zuerst das Todesresultat T, um die verbleibenden AP zu korrigieren.');
      }
      if (round.after[side] === value) return;
      round.after[side] = value;
    }
    if (index === fight.rounds.length - 1) fight.current[side] = round.after[side];
  }
}

export function parseLoggedFights(value: unknown): LoggedFight[] {
  const invalid = () => new Error('Ungültige Kampfdaten im Kampfprotokoll.');
  function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
  }
  function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw invalid();
    return value;
  }
  function pair(value: unknown, min = 0): Endurance {
    const { wolf, enemy } = record(value);
    return { wolf: integer(wolf, min), enemy: integer(enemy, min) };
  }
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalid();
  return value.map(entry => {
    const { strength, quotient, current, rounds } = record(entry);
    if (!Array.isArray(rounds)) throw invalid();
    return {
      strength: pair(strength, Number.MIN_SAFE_INTEGER),
      quotient: integer(quotient, Number.MIN_SAFE_INTEGER),
      current: pair(current),
      rounds: rounds.map(entry => {
        const { quotient, random, losses, before, after } = record(entry);
        const effects = record(losses);
        const result = {
          wolf: effects.wolf === null ? null : integer(effects.wolf),
          enemy: effects.enemy === null ? null : integer(effects.enemy),
        };
        const remaining = pair(after);
        if ((result.wolf === null && remaining.wolf !== 0) || (result.enemy === null && remaining.enemy !== 0)) throw invalid();
        return { quotient: integer(quotient, Number.MIN_SAFE_INTEGER), random: integer(random, 0, 9),
          losses: result, before: pair(before), after: remaining };
      }),
    };
  });
}
