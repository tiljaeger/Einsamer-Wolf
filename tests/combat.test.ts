import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { confirmRound, endurance, outcome, previewRound, startFight, strengthDetails, undoRound } from '../src/combat-state.ts';
import { parseReferenceTables } from '../src/table-model.ts';

const directory = new URL('../data/spielregeln/', import.meta.url);
const tables = parseReferenceTables(
  await readFile(new URL('kampfresultat_gesamt.csv', directory), 'utf8'),
  await readFile(new URL('zufallszahlen_tabelle.csv', directory), 'utf8'),
);

test('weapon modifiers exclude each other and mindblast is conditional', () => {
  const strength = { base: 15, enemy: 20, weapon: 'other', mindblast: true, adventure: 0 } as const;
  assert.deepEqual(strengthDetails(strength), { weapon: 0, mindblast: 2, effective: 17, quotient: -3 });
  assert.equal(strengthDetails({ ...strength, weapon: 'unarmed', adventure: -1 }).quotient, -8);
  assert.equal(strengthDetails({ ...strength, weapon: 'matching', mindblast: false }).quotient, -3);
  assert.throws(() => strengthDetails({ ...strength, adventure: 0.5 }));
  assert.throws(() => strengthDetails({ ...strength, enemy: -1 }));
});

test('preview uses the original table for every digit and both outer quotient categories', () => {
  const fight = startFight({ wolf: 20, enemy: 20 });
  for (const quotient of [-999, -11, -10, 0, 10, 11, 999]) {
    for (let random = 0; random < 10; random++) {
      assert.equal(previewRound(fight, quotient, random, tables).result, tables.getCombatResult(quotient, random));
    }
  }
  assert.throws(() => previewRound(fight, 0, 10, tables));
  assert.throws(() => previewRound(fight, 0, 0.5, tables));
  assert.throws(() => startFight({ wolf: -1, enemy: 2 }));
});

test('preview leaves endurance unchanged, confirmation applies both losses and undo restores previous endurance', () => {
  const fight = startFight({ wolf: 20, enemy: 16 });
  const preview = previewRound(fight, -3, 6, tables);
  assert.deepEqual(preview.after, { wolf: 17, enemy: 10 });
  assert.deepEqual(endurance(fight), { wolf: 20, enemy: 16 });
  assert.equal(fight.rounds.length, 0);
  const confirmed = confirmRound(fight, -3, 6, tables);
  assert.deepEqual(confirmed.rounds, [preview]);
  const second = confirmRound(confirmed, 0, 0, tables);
  assert.equal(second.rounds[1].result.loneWolf.original, '-0');
  assert.equal(endurance(second).wolf, 17);
  assert.deepEqual(undoRound(second), confirmed);
});

test('T and zero endurance end the fight, including simultaneous death, until undone', () => {
  const fresh = startFight({ wolf: 20, enemy: 16 });
  for (const [quotient, random, expected] of [[-999, 1, 'defeat'], [999, 8, 'victory']] as const) {
    const finished = confirmRound(fresh, quotient, random, tables);
    assert.equal(outcome(finished), expected);
    const killedSide = expected === 'defeat' ? 'loneWolf' : 'enemy';
    assert.equal(finished.rounds[0].result[killedSide].original, 'T');
    assert.throws(() => confirmRound(finished, quotient, random, tables));
    assert.equal(outcome(undoRound(finished)), 'active');
  }
  const both = confirmRound(startFight({ wolf: 1, enemy: 1 }), -3, 6, tables);
  assert.deepEqual(endurance(both), { wolf: 0, enemy: 0 });
  assert.equal(outcome(both), 'both');
  assert.equal(outcome(startFight({ wolf: 0, enemy: 10 })), 'defeat');
  assert.throws(() => previewRound({ ...fresh, stopped: true }, 0, 0, tables));
});
