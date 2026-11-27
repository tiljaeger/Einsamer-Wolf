import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addLoggedRound, changeStrength, correctRound, logStatus, newLoggedFight } from '../src/combat-log-state.ts';
import { renderLoggedFight } from '../src/combat-log.ts';
import { renderForms } from '../src/forms.ts';
import { clearCombatLog, createEmptyData, exportJSON, importJSON, loadData, parseCharacterData, readLoggedFight, saveData } from '../src/state.ts';
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
  const migrated = parseCharacterData(data);
  assert.equal(migrated.kampfprotokoll.ausdauerAktuell, 15);
  assert.equal(migrated.kampfprotokoll.kampfstaerke, 17);

  let saved = '';
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } as Storage;
  saveData(data, storage);
  assert.deepEqual(loadData(storage), migrated);
  assert.deepEqual(importJSON(exportJSON(data)), migrated);
  assert.equal(loadData(storage).kampfprotokoll.kampfrunden[3].kampfquotient, -3);

  const invalid = structuredClone(data);
  invalid.kampfprotokoll.kaempfe[0].rounds[0].random = 10;
  assert.throws(() => saveData(invalid, storage));
  assert.deepEqual(loadData(storage), migrated);
});

test('the start page combines character stats, combat log and action sheet', () => {
  const html = renderForms();
  assert.deepEqual([...html.matchAll(/class="sheet-panel" id="([^"]+)"/g)].map(match => match[1]), ['startseite']);
  assert.match(html, /class="sheet-stats"[\s\S]+data-path="kampfprotokoll.kampfstaerke"[\s\S]+data-path="kampfprotokoll.ausdauerAktuell"[\s\S]+>Kampfprotokoll<\/h2>[\s\S]+data-new-fight>Neuer Kampf[\s\S]+data-fights[\s\S]+id="aktionsblatt"/);
});

test('the combat log offers a collapsed history and a dedicated delete action', () => {
  const html = renderForms();
  assert.match(html, /data-clear-fights>Alle Kämpfe löschen/);
  assert.match(html, /data-fights><\/div>\s*<details class="sheet-fight-history">\s*<summary>Vergangene Kämpfe<\/summary>/);
  assert.match(html, /data-past-fights><\/div>\s*<details class="sheet-legacy">/);
});

test('clearing all fights and manual entries survives a JSON round trip and retains character data', () => {
  const data = createEmptyData();
  data.aktionsblatt.waffen[0] = 'Schwert';
  data.karte.location = { x: 100, y: 200 };
  const sheet = data.kampfprotokoll;
  sheet.kampfstaerke = 17;
  sheet.ausdauerGrundwert = 25;
  sheet.ausdauerAktuell = 19;
  sheet.kaempfe = [newLoggedFight(25, 17), newLoggedFight(19, 17)];
  sheet.kampfrunden[0].kampfquotient = 0;

  const cleared = importJSON(exportJSON({ ...data, kampfprotokoll: clearCombatLog(sheet) }));
  assert.deepEqual(cleared.kampfprotokoll, {
    ...createEmptyData().kampfprotokoll, kampfstaerke: 17, ausdauerGrundwert: 25, ausdauerAktuell: 19,
  });
  assert.deepEqual(cleared.aktionsblatt, data.aktionsblatt);
  assert.deepEqual(cleared.karte, data.karte);
  assert.equal(sheet.kaempfe.length, 2);
  assert.equal(sheet.kampfrunden[0].kampfquotient, 0);
});

test('combat log renders editable labelled values and exposes the finished state', () => {
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

test('the latest fight follows character stats and keeps historical rounds on reload', () => {
  const data = createEmptyData();
  const sheet = data.kampfprotokoll;
  sheet.kampfstaerke = 17;
  sheet.ausdauerGrundwert = 24;
  sheet.ausdauerAktuell = 20;
  const oldFight = newLoggedFight(12, 15);
  const currentFight = newLoggedFight(20, 17);
  currentFight.current.enemy = 20;
  changeStrength(currentFight, 'enemy', 20);
  sheet.kaempfe.push(oldFight, currentFight);

  // Apply the effective strength after an equipment bonus.
  sheet.kampfstaerke = 19;
  const liveFight = readLoggedFight(sheet, 1);
  assert.equal(liveFight.quotient, -1);
  addLoggedRound(liveFight, tables, 6);
  sheet.ausdauerAktuell = liveFight.current.wolf;
  sheet.kaempfe[1] = liveFight;

  const reloaded = importJSON(exportJSON(data)).kampfprotokoll;
  assert.deepEqual(reloaded.kaempfe[0], oldFight);
  assert.equal(reloaded.kaempfe[1].current.wolf, reloaded.ausdauerAktuell);
  assert.equal(reloaded.kaempfe[1].strength.wolf, 19);

  reloaded.ausdauerAktuell = 22;
  reloaded.kampfstaerke = 17;
  const corrected = readLoggedFight(reloaded, 1);
  assert.equal(corrected.current.wolf, 22);
  assert.equal(corrected.quotient, -3);
  assert.equal(corrected.rounds[0].quotient, -1);
});


test('new character stats do not reopen the last completed fight on reload', () => {
  const data = createEmptyData();
  const sheet = data.kampfprotokoll;
  const fight = newLoggedFight(1, 17);
  fight.current.enemy = 30;
  changeStrength(fight, 'enemy', 20);
  addLoggedRound(fight, tables, 6);
  assert.equal(fight.current.wolf, 0);
  sheet.kaempfe.push(fight);
  sheet.ausdauerAktuell = 20;
  sheet.kampfstaerke = 19;

  const reloaded = importJSON(exportJSON(data)).kampfprotokoll;
  assert.deepEqual(readLoggedFight(reloaded, 0), fight);
  assert.equal(reloaded.ausdauerAktuell, 20);
  assert.equal(reloaded.kampfstaerke, 19);
});
