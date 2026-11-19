import type { CombatEffect, CombatResult, ReferenceTables } from './table-model.ts';

export interface Endurance { wolf: number; enemy: number }
export interface Strength {
  base: number;
  enemy: number;
  weapon: 'matching' | 'other' | 'unarmed';
  mindblast: boolean;
  adventure: number;
}
export interface Round {
  quotient: number;
  random: number;
  result: CombatResult;
  before: Endurance;
  after: Endurance;
}
export interface Fight {
  start: Endurance;
  rounds: readonly Round[];
  stopped: boolean;
}

export function strengthDetails(input: Strength) {
  const weapon = { matching: 2, other: 0, unarmed: -4 }[input.weapon];
  const mindblast = input.mindblast ? 2 : 0;
  const effective = input.base + weapon + mindblast + input.adventure;
  const quotient = effective - input.enemy;
  if (![input.base, input.enemy, input.adventure, effective, quotient].every(Number.isSafeInteger) || input.base < 0 || input.enemy < 0) {
    throw new Error('Bitte gültige ganzzahlige Kampfstärken und Modifikatoren eingeben.');
  }
  return { weapon, mindblast, effective, quotient };
}

export function startFight(start: Endurance): Fight {
  if (![start.wolf, start.enemy].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('Bitte gültige ganze Ausdauerwerte ab 0 eingeben.');
  }
  return { start: { ...start }, rounds: [], stopped: false };
}

export function endurance(fight: Fight): Endurance {
  return fight.rounds.at(-1)?.after ?? fight.start;
}

export function outcome(fight: Fight): 'active' | 'victory' | 'defeat' | 'both' | 'stopped' {
  const { wolf, enemy } = endurance(fight);
  if (wolf === 0) return enemy === 0 ? 'both' : 'defeat';
  if (enemy === 0) return 'victory';
  return fight.stopped ? 'stopped' : 'active';
}

function remaining(value: number, effect: CombatEffect): number {
  return effect.death ? 0 : Math.max(0, value - effect.loss);
}

export function previewRound(fight: Fight, quotient: number, random: number, tables: ReferenceTables): Round {
  if (outcome(fight) !== 'active') throw new Error('Der Kampf ist beendet.');
  const before = endurance(fight);
  const result = tables.getCombatResult(quotient, random);
  return {
    quotient, random, result, before,
    after: { wolf: remaining(before.wolf, result.loneWolf), enemy: remaining(before.enemy, result.enemy) },
  };
}

export function confirmRound(fight: Fight, quotient: number, random: number, tables: ReferenceTables): Fight {
  return { ...fight, rounds: [...fight.rounds, previewRound(fight, quotient, random, tables)] };
}

export function undoRound(fight: Fight): Fight {
  return { ...fight, rounds: fight.rounds.slice(0, -1) };
}
