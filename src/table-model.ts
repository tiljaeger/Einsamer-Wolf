export const quotientRanges = [
  { key: '<=-11', label: '≤ −11', min: -Infinity, max: -11 },
  { key: '-10/-9', label: '−10 / −9', min: -10, max: -9 },
  { key: '-8/-7', label: '−8 / −7', min: -8, max: -7 },
  { key: '-6/-5', label: '−6 / −5', min: -6, max: -5 },
  { key: '-4/-3', label: '−4 / −3', min: -4, max: -3 },
  { key: '-2/-1', label: '−2 / −1', min: -2, max: -1 },
  { key: '0', label: '0', min: 0, max: 0 },
  { key: '+1/+2', label: '+1 / +2', min: 1, max: 2 },
  { key: '+3/+4', label: '+3 / +4', min: 3, max: 4 },
  { key: '+5/+6', label: '+5 / +6', min: 5, max: 6 },
  { key: '+7/+8', label: '+7 / +8', min: 7, max: 8 },
  { key: '+9/+10', label: '+9 / +10', min: 9, max: 10 },
  { key: '>=+11', label: '≥ +11', min: 11, max: Infinity },
] as const;
export type CombatEffect = Readonly<{ original: string } & ({ death: true; loss: null } | { death: false; loss: number })>;
export interface CombatResult { readonly enemy: CombatEffect; readonly loneWolf: CombatEffect }
export interface RandomSelection { readonly row: number; readonly column: number; readonly value: number }
export interface ReferenceTables {
  readonly combat: readonly (readonly CombatResult[])[];
  readonly random: readonly (readonly number[])[];
  getCombatResult(combatQuotient: number, randomNumber: number): CombatResult;
  selectRandomNumber(row: number, column: number): RandomSelection;
}
function rows(csv: string, header: string): string[][] {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.shift() !== header) throw new Error('Unerwartete CSV-Spalten.');
  return lines.map(line => line.split(','));
}
function digit(value: string): number {
  if (!/^[0-9]$/.test(value)) throw new Error('Zufallszahl muss zwischen 0 und 9 liegen.');
  return Number(value);
}
function effect(value: string): CombatEffect {
  if (value === 'T') return Object.freeze({ original: value, death: true, loss: null });
  if (!/^-(?:0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Ungültiges Kampfresultat.');
  return Object.freeze({ original: value, death: false, loss: Math.abs(Number(value)) });
}
export function quotientColumn(combatQuotient: number): number {
  if (!Number.isSafeInteger(combatQuotient)) throw new Error('Kampfquotient muss eine ganze Zahl sein.');
  return quotientRanges.findIndex(range => combatQuotient >= range.min && combatQuotient <= range.max);
}
/** The two approved CSV files are the only source of table values. Fail on gaps or ambiguities. */
export function parseReferenceTables(combatCSV: string, randomCSV: string): ReferenceTables {
  const combat: (CombatResult | undefined)[][] = Array.from({ length: 10 }, () => Array(13).fill(undefined));
  const entries = rows(combatCSV, 'zufallszahl,kampfquotient_bereich,feind_resultat,einsamer_wolf_resultat');
  if (entries.length !== 130) throw new Error('Die Kampfresultat-Tabelle benötigt 130 Einträge.');
  for (const entry of entries) {
    if (entry.length !== 4) throw new Error('Ungültige Kampfresultat-Zeile.');
    const [random, key, enemy, loneWolf] = entry;
    const row = digit(random);
    const column = quotientRanges.findIndex(range => range.key === key);
    if (column < 0 || combat[row][column]) throw new Error('Unbekannter oder doppelter Kampfquotientenbereich.');
    combat[row][column] = Object.freeze({ enemy: effect(enemy), loneWolf: effect(loneWolf) });
  }
  if (combat.some(row => row.some(value => value === undefined))) throw new Error('Unvollständige Kampfresultat-Tabelle.');
  const randomRows = rows(randomCSV, 'zeile,' + Array.from({ length: 10 }, (_, index) => `spalte_${index + 1}`).join(','));
  if (randomRows.length !== 10) throw new Error('Die Zufallszahlen-Tabelle benötigt zehn Zeilen.');
  const random = Object.freeze(randomRows.map((row, index) => {
    if (row.length !== 11 || row[0] !== String(index + 1)) throw new Error('Ungültige Reihenfolge oder Größe des Zufallszahlenrasters.');
    return Object.freeze(row.slice(1).map(digit));
  }));
  const complete = Object.freeze(combat.map(row => Object.freeze(row as CombatResult[])));
  return Object.freeze({
    combat: complete, random,
    getCombatResult(combatQuotient: number, randomNumber: number): CombatResult {
      if (!Number.isInteger(randomNumber) || randomNumber < 0 || randomNumber > 9) throw new Error('Zufallszahl muss eine ganze Zahl von 0 bis 9 sein.');
      return complete[randomNumber][quotientColumn(combatQuotient)];
    },
    selectRandomNumber(row: number, column: number): RandomSelection {
      if (![row, column].every(value => Number.isInteger(value) && value >= 0 && value < 10)) throw new Error('Rasterposition muss zwischen 0 und 9 liegen.');
      return Object.freeze({ row, column, value: random[row][column] });
    },
  });
}
