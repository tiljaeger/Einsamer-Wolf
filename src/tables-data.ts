import combatCSV from '../data/spielregeln/kampfresultat_gesamt.csv?raw';
import randomCSV from '../data/spielregeln/zufallszahlen_tabelle.csv?raw';
import { parseReferenceTables } from './table-model';

export const referenceTables = parseReferenceTables(combatCSV, randomCSV);
export const getCombatResult = referenceTables.getCombatResult;
export const selectRandomNumber = referenceTables.selectRandomNumber;
