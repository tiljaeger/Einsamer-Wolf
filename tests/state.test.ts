import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyData, exportJSON, importJSON, loadData, saveData, STORAGE_KEY } from '../src/state.ts';

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
}

test('all values survive JSON export, import, storage and restore', () => {
  const data = createEmptyData();
  data.aktionsblatt.kaiDisziplinen[4] = 'Heilung';
  data.aktionsblatt.waffen[1] = 'Schwert';
  data.aktionsblatt.rucksack[7] = 'Seil';
  data.aktionsblatt.mahlzeiten = 0;
  data.aktionsblatt.spezielleGegenstaende = 'Mondstein\nKarte';
  data.aktionsblatt.goldkronen = 50;
  data.kampfprotokoll.kampfstaerke = -2;
  data.kampfprotokoll.ausdauerGrundwert = 20;
  data.kampfprotokoll.ausdauerAktuell = 12;
  data.kampfprotokoll.kampfrunden[6] = { einsamerWolfAP: 12, kampfquotient: -4, feindAP: 0 };
  const imported = importJSON(exportJSON(data));
  assert.deepEqual(imported, data);
  const storage = fakeStorage();
  saveData(imported, storage);
  assert.deepEqual(loadData(storage), data);
});

test('invalid imports and saves are rejected without overwriting the saved data', () => {
  const data = createEmptyData();
  data.aktionsblatt.waffen[0] = 'Axt';
  const storage = fakeStorage();
  saveData(data, storage);
  assert.throws(() => importJSON('{kaputt'), /JSON/);
  const invalid = structuredClone(data);
  invalid.aktionsblatt.goldkronen = 51;
  assert.throws(() => saveData(invalid, storage), /Goldkronen/);
  assert.deepEqual(loadData(storage), data);
  invalid.aktionsblatt.goldkronen = 50;
  invalid.kampfprotokoll.ausdauerGrundwert = 4;
  invalid.kampfprotokoll.ausdauerAktuell = 5;
  assert.throws(() => importJSON(JSON.stringify(invalid)), /Grundwert/);
});

test('missing save yields a blank sheet; corrupted save remains untouched', () => {
  const storage = fakeStorage();
  assert.deepEqual(loadData(storage), createEmptyData());
  storage.setItem(STORAGE_KEY, '{kaputt');
  assert.throws(() => loadData(storage));
  assert.equal(storage.getItem(STORAGE_KEY), '{kaputt');
});
