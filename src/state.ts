/** Versioned, browser-local data for the two sheets. Empty numeric fields remain empty. */
export type NumericValue = number | '';

export interface CombatRound {
  einsamerWolfAP: NumericValue;
  kampfquotient: NumericValue;
  feindAP: NumericValue;
}

export interface CharacterData {
  aktionsblatt: {
    kaiDisziplinen: string[];
    waffen: string[];
    rucksack: string[];
    mahlzeiten: NumericValue;
    spezielleGegenstaende: string;
    goldkronen: NumericValue;
  };
  kampfprotokoll: {
    kampfstaerke: NumericValue;
    ausdauerGrundwert: NumericValue;
    ausdauerAktuell: NumericValue;
    kampfrunden: CombatRound[];
  };
}

export const STORAGE_KEY = 'einsamer-wolf-charakterbogen-v1';

export function createEmptyData(): CharacterData {
  return {
    aktionsblatt: {
      kaiDisziplinen: Array.from({ length: 5 }, () => ''),
      waffen: Array.from({ length: 2 }, () => ''),
      rucksack: Array.from({ length: 8 }, () => ''),
      mahlzeiten: '', spezielleGegenstaende: '', goldkronen: '',
    },
    kampfprotokoll: {
      kampfstaerke: '', ausdauerGrundwert: '', ausdauerAktuell: '',
      kampfrunden: Array.from({ length: 7 }, () => ({ einsamerWolfAP: '', kampfquotient: '', feindAP: '' })),
    },
  };
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} ist kein gültiger Abschnitt.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} muss Text enthalten.`);
  return value;
}

function textArray(value: unknown, size: number, name: string): string[] {
  if (!Array.isArray(value) || value.length !== size) {
    throw new Error(`${name} muss genau ${size} Einträge enthalten.`);
  }
  return value.map((entry, index) => text(entry, `${name} ${index + 1}`));
}

function numberValue(value: unknown, name: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): NumericValue {
  if (value === '') return '';
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} muss eine gültige ganze Zahl${min === 0 ? ' ab 0' : ''}${max === 50 ? ' bis 50' : ''} sein.`);
  }
  return value;
}

/** Validate the complete document before replacing anything in a form or storage. */
export function parseCharacterData(value: unknown): CharacterData {
  const data = record(value, 'Die Datei');
  const a = record(data.aktionsblatt, 'Aktionsblatt');
  const k = record(data.kampfprotokoll, 'Kampfprotokoll');
  if (!Array.isArray(k.kampfrunden) || k.kampfrunden.length !== 7) {
    throw new Error('Das Kampfprotokoll muss genau 7 Kampfzeilen enthalten.');
  }
  const grundwert = numberValue(k.ausdauerGrundwert, 'Ausdauer-Grundwert', 0);
  const aktuell = numberValue(k.ausdauerAktuell, 'Aktuelle Ausdauer', 0);
  if (grundwert !== '' && aktuell !== '' && aktuell > grundwert) {
    throw new Error('Die aktuelle Ausdauer darf nicht über dem Grundwert liegen.');
  }
  const kampfrunden = k.kampfrunden.map((value, index): CombatRound => {
    const round = record(value, `Kampfzeile ${index + 1}`);
    return {
      einsamerWolfAP: numberValue(round.einsamerWolfAP, `Ausdauer Einsamer Wolf, Kampfzeile ${index + 1}`, 0),
      kampfquotient: numberValue(round.kampfquotient, `Kampfquotient, Kampfzeile ${index + 1}`),
      feindAP: numberValue(round.feindAP, `Ausdauer Feind, Kampfzeile ${index + 1}`, 0),
    };
  });
  return {
    aktionsblatt: {
      kaiDisziplinen: textArray(a.kaiDisziplinen, 5, 'Kai-Disziplinen'),
      waffen: textArray(a.waffen, 2, 'Waffen'),
      rucksack: textArray(a.rucksack, 8, 'Rucksack'),
      mahlzeiten: numberValue(a.mahlzeiten, 'Mahlzeiten', 0),
      spezielleGegenstaende: text(a.spezielleGegenstaende, 'Spezielle Gegenstände'),
      goldkronen: numberValue(a.goldkronen, 'Goldkronen', 0, 50),
    },
    kampfprotokoll: {
      kampfstaerke: numberValue(k.kampfstaerke, 'Kampfstärke'),
      ausdauerGrundwert: grundwert, ausdauerAktuell: aktuell, kampfrunden,
    },
  };
}

export function importJSON(raw: string): CharacterData {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; }
  catch { throw new Error('Die Datei enthält kein gültiges JSON.'); }
  return parseCharacterData(value);
}

export function exportJSON(data: CharacterData): string {
  return JSON.stringify(parseCharacterData(data), null, 2);
}

/** Missing data is normal; malformed or inaccessible data throws without deleting it. */
export function loadData(storage: Storage = localStorage): CharacterData {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? createEmptyData() : importJSON(raw);
}

/** Parse first, so a failed validation never replaces a previous valid save. */
export function saveData(data: CharacterData, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, exportJSON(data));
}
