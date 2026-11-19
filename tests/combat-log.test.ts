import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addLoggedRound, changeStrength, correctRound, logStatus, newLoggedFight } from '../src/combat-log-state.ts';
import { renderLoggedFight } from '../src/combat-log.ts';
import { renderForms } from '../src/forms.ts';
import { createEmptyData, exportJSON, importJSON, loadData, saveData } from '../src/state.ts';
import { parseReferenceTables } from '../src/table-model.ts';

const tables = parseReferenceTables(
  readFileSync(new URL('../data/spielregeln/kampfresultat_gesamt.csv', import.meta.url), 'utf8'),
  readFileSync(new URL('../data/spielregeln/zufallszahlen_tabelle.csv', import.meta.url), 'utf8'),
);

test('each fight has its own strengths and quotient override', () => {
  const fight = newLoggedFight(25, 17);
  const other = newLoggedFight(24, 16);
  assert.equal(fight.quotient, 17);
  changeStrength(fight, 'enemy', 20);
  assert.equal(fight.quotient, -3);
  fight.quotient = 99;
  changeStrength(fight, 'enemy', 20);
  assert.equal(fight.quotient, 99);
  changeStrength(fight, 'wolf', 22);
  assert.equal(fight.quotient, 2);
  assert.equal(other.quotient, 16);
  assert.deepEqual(other.strength, { wolf: 16, enemy: 0 });
});

test('all digits use the reference table and the corrected current values feed the next round', () => {
  for (let digit = 0; digit < 10; digit++) {
    const fight = newLoggedFight(20, 17);
    fight.current.enemy = 20;
    changeStrength(fight, 'enemy', 20);
    addLoggedRound(fight, tables, digit);
    const { loneWolf, enemy } = tables.getCombatResult(-3, digit);
    assert.deepEqual(fight.rounds[0].losses, { wolf: loneWolf.loss, enemy: enemy.loss });
    assert.deepEqual(fight.current, fight.rounds[0].after);
  }

  const fight = newLoggedFight(20, 17);
  fight.current.enemy = 20;
  changeStrength(fight, 'enemy', 20);
  addLoggedRound(fight, tables, 6);
  assert.deepEqual(fight.current, { wolf: 17, enemy: 14 });
  correctRound(fight, 0, 'loss', 2, 'enemy', tables);
  correctRound(fight, 0, 'after', 19, 'wolf', tables);
  fight.quotient = 1;
  addLoggedRound(fight, tables, 5);
  assert.deepEqual(fight.rounds[1].before, { wolf: 19, enemy: 18 });
  assert.equal(fight.rounds[1].quotient, 1);
  const current = { ...fight.current };
  correctRound(fight, 0, 'after', 20, 'wolf', tables);
  assert.deepEqual(fight.current, current);
});

test('rolling stops after T or zero AP and resumes after explicit corrections', () => {
  const fight = newLoggedFight(20, 20);
  assert.throws(() => addLoggedRound(fight, tables, 8));
  fight.current.enemy = 15;
  fight.quotient = 999;
  addLoggedRound(fight, tables, 8);
  assert.equal(fight.rounds[0].losses.enemy, null);
  assert.equal(fight.current.enemy, 0);
  assert.match(logStatus(fight), /Feind ist tot/);
  assert.throws(() => addLoggedRound(fight, tables, 8));
  assert.throws(() => correctRound(fight, 0, 'after', 10, 'enemy', tables));
  correctRound(fight, 0, 'quotient', 0, 'enemy', tables);
  assert.equal(logStatus(fight), '');
  correctRound(fight, 0, 'after', 0, 'wolf', tables);
  assert.match(logStatus(fight), /Einsamer Wolf ist tot/);
});

test('old saves migrate and new fights survive JSON export and a storage reload', () => {
  const legacy = JSON.parse(exportJSON(createEmptyData()));
  delete legacy.kampfprotokoll.kaempfe;
  legacy.kampfprotokoll.kampfrunden[3].kampfquotient = -3;
  const data = importJSON(JSON.stringify(legacy));
  assert.deepEqual(data.kampfprotokoll.kaempfe, []);
  const fight = newLoggedFight(20, 20);
  fight.current.enemy = 10;
  addLoggedRound(fight, tables, 8);
  data.kampfprotokoll.kaempfe.push(fight, newLoggedFight(15, 17));

  let saved = '';
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } as Storage;
  saveData(data, storage);
  assert.deepEqual(loadData(storage), data);
  assert.deepEqual(importJSON(exportJSON(data)), data);
  assert.equal(loadData(storage).kampfprotokoll.kampfrunden[3].kampfquotient, -3);

  const invalid = structuredClone(data);
  invalid.kampfprotokoll.kaempfe[0].rounds[0].random = 10;
  assert.throws(() => saveData(invalid, storage));
  assert.deepEqual(loadData(storage), data);
});

test('combat log renders editable labelled values and exposes the finished state', () => {
  assert.match(renderForms(), /data-new-fight>Neuer Kampf/);
  const fight = newLoggedFight(20, 20);
  fight.current.enemy = 15;
  addLoggedRound(fight, tables, 8);
  const html = renderLoggedFight(fight, 1);
  assert.match(html, /Kampf 2/);
  assert.match(html, /Einsamer Wolf<\/legend>[\s\S]+Kampfquotient \(KQ\)<input[^>]*value="20"[\s\S]+Feind<\/legend>/);
  assert.match(html, /data-new-round disabled>Neue Runde/);
  assert.match(html, /role="status">Kampf beendet/);
  assert.match(html, /Verlust Feind \(AP\/T\)<input[^>]+value="T"/);
  assert.match(html, /Zufallszahl<input[^>]+value="8"/);
});
