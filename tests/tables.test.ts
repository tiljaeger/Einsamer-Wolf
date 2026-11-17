import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseReferenceTables, quotientColumn, quotientRanges } from '../src/table-model.ts';
import { renderTables } from '../src/tables.ts';
import { isRulesHash } from '../src/rules.ts';
const combatCSV = await readFile(new URL('../data/spielregeln/kampfresultat_gesamt.csv', import.meta.url), 'utf8');
const randomCSV = await readFile(new URL('../data/spielregeln/zufallszahlen_tabelle.csv', import.meta.url), 'utf8');
const tables = parseReferenceTables(combatCSV, randomCSV);

test('all 130 CSV entries retain F/EW assignment and original results, including -0 and T', () => {
  assert.equal(tables.combat.length, 10);
  for (const row of tables.combat) assert.equal(row.length, 13);
  for (const line of combatCSV.trim().split(/\r?\n/).slice(1)) {
    const [random, key, enemy, wolf] = line.split(',');
    const range = quotientRanges.find(range => range.key === key)!;
    const q = Number.isFinite(range.min) ? range.min : -11;
    const result = tables.getCombatResult(q, Number(random));
    for (const [effect, original] of [[result.enemy, enemy], [result.loneWolf, wolf]] as const) {
      assert.equal(effect.original, original);
      assert.equal(effect.death, original === 'T');
      assert.equal(effect.loss, original === 'T' ? null : Math.abs(Number(original)));
    }
  }
  assert.deepEqual(tables.getCombatResult(-3, 6), {
    enemy: { original: '-6', death: false, loss: 6 }, loneWolf: { original: '-3', death: false, loss: 3 },
  });
  assert.equal(tables.getCombatResult(-11, 1).loneWolf.death, true);
  assert.equal(tables.getCombatResult(11, 8).enemy.death, true);
  assert.equal(tables.getCombatResult(0, 0).loneWolf.loss, 0);
  assert.equal(Object.is(tables.getCombatResult(0, 0).loneWolf.loss, -0), false);
});

test('every quotient boundary, zero and outer range maps correctly for all digits', () => {
  const expected = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  for (let q = -11; q <= 11; q++) {
    assert.equal(quotientColumn(q), expected[q + 11]);
    for (let n = 0; n <= 9; n++) assert.equal(tables.getCombatResult(q, n), tables.combat[n][expected[q + 11]]);
  }
  for (const n of [0, 1, 9]) {
    assert.equal(tables.getCombatResult(-999, n), tables.getCombatResult(-11, n));
    assert.equal(tables.getCombatResult(999, n), tables.getCombatResult(11, n));
  }
  for (const q of [NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => tables.getCombatResult(q, 1));
  for (const n of [-1, 10, NaN, Infinity, .5]) assert.throws(() => tables.getCombatResult(0, n));
});

test('all 100 random digits retain their row and column and repeated selection works', () => {
  const expected = [
    [1,3,9,3,2,7,5,0,2,5], [5,6,2,5,1,3,8,4,3,5], [7,6,7,8,1,4,3,1,4,5],
    [4,0,8,7,3,0,8,7,2,5], [7,4,0,0,9,6,2,0,8,1], [1,6,7,9,6,9,0,3,3,9],
    [8,9,2,8,1,3,4,9,7,1], [6,3,0,7,5,0,5,4,6,6], [7,2,1,4,2,9,6,4,2,6], [0,9,6,4,8,2,8,5,8,3],
  ];
  assert.deepEqual(tables.random, expected);
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const result = { row: r, column: c, value: expected[r][c] };
    assert.deepEqual(tables.selectRandomNumber(r, c), result);
    assert.deepEqual(tables.selectRandomNumber(r, c), result);
  }
  for (const n of [-1, 10, NaN, .1]) assert.throws(() => tables.selectRandomNumber(n, 0));
  assert.throws(() => tables.selectRandomNumber(0, 10));
});

test('bad headers, missing/duplicate results, invalid values and changed grid shape fail closed', () => {
  for (const csv of [combatCSV.replace('feind_resultat', 'other'), combatCSV.split(/\r?\n/).slice(0, -2).join('\n'), combatCSV.replace('1,-10/-9,-0,T', '1,<=-11,-0,T'), combatCSV.replace(',-0,T', ',?,T'), combatCSV.replace(',-0,T', ',1,T')]) assert.throws(() => parseReferenceTables(csv, randomCSV));
  for (const csv of [randomCSV.replace('1,1,3,9', '2,1,3,9'), randomCSV.replace('1,1,3,9', '1,1,3,10'), randomCSV.split(/\r?\n/).slice(0, -2).join('\n')]) assert.throws(() => parseReferenceTables(combatCSV, csv));
});

test('table navigation, 130 F/EW cells, 100 accessible selectable fields and original row order render', () => {
  const html = renderTables(tables);
  assert.equal((html.match(/data-random-row=/g) ?? []).length, 100);
  assert.equal((html.match(/<td data-column=/g) ?? []).length, 130);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 100);
  assert.ok(html.indexOf('data-random="9"') < html.indexOf('data-random="0"'));
  for (const id of ['kampfresultate', 'zufallszahlen']) {
    assert.ok(isRulesHash(`#rules-${id}`)); assert.ok(html.includes(`id="rules-${id}"`));
  }
  assert.ok(html.includes('Zeile 10, Spalte 10: 3'));
  assert.ok(html.includes('F = Feind · EW = Einsamer Wolf · T = Tod'));
});
