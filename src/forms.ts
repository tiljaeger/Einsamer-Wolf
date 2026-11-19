/** Statische Struktur der beiden ausfüllbaren Charakterbogen-Seiten. */
function textField(path: string, label: string): string {
  return `<span class="sheet-field"><input class="sheet-input" type="text" data-path="${path}" aria-label="${label}" autocomplete="off"><span class="sheet-field-value" aria-hidden="true"></span></span>`;
}

function numberField(path: string, label: string, bounds = ''): string {
  return `<span class="sheet-field"><input class="sheet-input sheet-number" type="number" inputmode="numeric" step="1" ${bounds} data-path="${path}" aria-label="${label}"><span class="sheet-field-value" aria-hidden="true"></span></span>`;
}

function textareaField(path: string, label: string): string {
  return `<span class="sheet-field sheet-field-multiline"><textarea class="sheet-input sheet-textarea" data-path="${path}" aria-label="${label}"></textarea><span class="sheet-field-value" aria-hidden="true"></span></span>`;
}

function numberedRows(path: string, label: string, count: number): string {
  return Array.from({ length: count }, (_, i) => `<div class="sheet-row"><span class="sheet-row-index">${i + 1}</span>${textField(`${path}.${i}`, `${label} ${i + 1}`)}</div>`).join('');
}

function combatRows(): string {
  return Array.from({ length: 7 }, (_, i) => `<div class="sheet-round">
    <div class="sheet-round-cell"><span class="sheet-round-label">EINSAMER WOLF</span>${numberField(`kampfprotokoll.kampfrunden.${i}.einsamerWolfAP`, `Kampf ${i + 1}: Ausdauerpunkte Einsamer Wolf`, 'min="0"')}</div>
    <div class="sheet-round-cell"><span class="sheet-round-label">KAMPFQUOTIENT</span>${numberField(`kampfprotokoll.kampfrunden.${i}.kampfquotient`, `Kampf ${i + 1}: Kampfquotient`)}</div>
    <div class="sheet-round-cell"><span class="sheet-round-label">FEIND</span>${numberField(`kampfprotokoll.kampfrunden.${i}.feindAP`, `Kampf ${i + 1}: Ausdauerpunkte Feind`, 'min="0"')}</div>
  </div>`).join('');
}

/** Liefert beide Formularseiten. Felder werden über data-path mit CharacterData verbunden. */
export function renderForms(): string {
  return `<section class="sheet-panel" id="aktionsblatt" aria-labelledby="aktionsblatt-title">
  <article class="sheet-page sheet-action">
    <h2 class="sheet-title" id="aktionsblatt-title">AKTIONSBLATT</h2><a class="rule-link" href="#rules-startwerte">Regeln zu Startwerten</a><a class="rule-link" href="#kampfhelfer">Kampfhelfer öffnen</a>
    <section class="sheet-section sheet-disciplines" aria-labelledby="discipline-heading">
      <h3 class="sheet-heading" id="discipline-heading">KAI DISZIPLINEN</h3>
      <p class="kai-rank" aria-live="polite"></p><a class="rule-link" href="#rules-disziplinen">Kai-Disziplinen und Heilung nachlesen</a><a class="rule-link" href="#rules-kai-rang">Kai-Ränge nachlesen</a><div class="sheet-rows sheet-box">${numberedRows('aktionsblatt.kaiDisziplinen', 'Kai-Disziplin', 5)}</div>
    </section>
    <section class="sheet-section sheet-weapons" aria-labelledby="weapons-heading">
      <h3 class="sheet-heading" id="weapons-heading">WAFFEN <span>(maximal 2 Waffen)</span></h3>
      <div class="sheet-rows sheet-box">${numberedRows('aktionsblatt.waffen', 'Waffe', 2)}</div>
      <div class="sheet-notes"><p>Bei Kampf mit einer Waffe einer erlernten Waffendisziplin KS +2.</p><p>Bei Kampf ohne Waffe KS -4.</p></div>
    </section>
    <section class="sheet-section sheet-rucksack" aria-labelledby="backpack-heading">
      <a class="rule-link" href="#rules-inventar">Ausrüstungsregeln nachlesen</a><h3 class="sheet-heading" id="backpack-heading">RUCKSACK <span>(maximal 8 Gegenstände)</span></h3>
      <div class="sheet-box sheet-backpack">
        <div class="sheet-backpack-items"><h4>GEGENSTÄNDE</h4><div class="sheet-rows">${numberedRows('aktionsblatt.rucksack', 'Gegenstand', 8)}</div><p class="sheet-notes">können jederzeit außerhalb eines Kampfes abgelegt oder ausgewechselt werden.</p></div>
        <div class="sheet-meals"><h4>MAHLZEITEN</h4>${numberField('aktionsblatt.mahlzeiten', 'Anzahl Mahlzeiten', 'min="0"')}<p class="sheet-notes">-3 AP falls keine Mahlzeit zu sich genommen wird, wenn dies angeordnet ist.</p></div>
      </div>
    </section>
    <div class="sheet-lower">
      <section class="sheet-box sheet-special" aria-labelledby="special-heading"><h3 class="sheet-heading" id="special-heading">SPEZIELLE GEGENSTÄNDE</h3>${textareaField('aktionsblatt.spezielleGegenstaende', 'Spezielle Gegenstände')}</section>
      <section class="sheet-box sheet-purse" aria-labelledby="purse-heading"><h3 class="sheet-heading" id="purse-heading">GELDBÖRSE</h3><p>Beinhaltet Goldkronen (maximal 50)</p>${numberField('aktionsblatt.goldkronen', 'Goldkronen', 'min="0" max="50"')}</section>
    </div>
    <footer class="sheet-footer"><span>KS = KAMPFSTÄRKE</span><span>AP = AUSDAUERPUNKTE</span></footer>
  </article>
</section>
<section class="sheet-panel" id="kampfprotokoll" aria-labelledby="kampfprotokoll-title">
  <article class="sheet-page sheet-combat">
    <div class="sheet-stats">
      <section class="sheet-box sheet-stat"><h3 class="sheet-heading">KAMPFSTÄRKE</h3>${numberField('kampfprotokoll.kampfstaerke', 'Kampfstärke')}</section>
      <section class="sheet-box sheet-stat sheet-endurance"><h3 class="sheet-heading">AUSDAUERPUNKTE</h3><div class="sheet-endurance-fields"><label>Grundwert ${numberField('kampfprotokoll.ausdauerGrundwert', 'Ausdauer Grundwert', 'min="0"')}</label><label>Aktuell ${numberField('kampfprotokoll.ausdauerAktuell', 'Aktuelle Ausdauerpunkte', 'min="0"')}</label></div><div class="sheet-notes"><p>kann nie über den Grundwert steigen.</p><p>0 = Tot</p></div></section>
    </div>
    <h2 class="sheet-title" id="kampfprotokoll-title">KAMPFPROTOKOLL</h2><a class="rule-link" href="#rules-kampf">Kampfregeln</a><a class="rule-link" href="#kampfhelfer">Kampfhelfer öffnen</a>
    <button class="combat-log-new" type="button" data-new-fight>Neuer Kampf</button>
    <div class="combat-log" data-fights></div>
    <div class="sheet-combat-headings" aria-hidden="true"><span>AUSDAUERPUNKTE</span><span></span><span>AUSDAUERPUNKTE</span></div>
    <div class="sheet-rounds sheet-box">${combatRows()}</div>
    <div class="sheet-ornament" aria-hidden="true">✦</div>
  </article>
</section>`;
}
