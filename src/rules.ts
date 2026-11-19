export interface Chapter { id: string; title: string; markdown: string }
const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (value: string): string => escape(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** Small, escaped renderer for the editorial Markdown subset used by the handbook. */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  let html = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#### ')) { html += `<h4 id="waffenkunde" tabindex="-1">${inline(line.slice(5))}</h4>`; continue; }
    if (line.startsWith('|')) {
      const cells = (row: string) => row.trim().slice(1, -1).split('|').map(cell => cell.trim());
      html += '<div class="rules-table"><table><thead><tr>' + cells(line).map(cell => `<th scope="col">${inline(cell)}</th>`).join('') + '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        html += '<tr>' + cells(lines[i]).map(cell => `<td>${inline(cell)}</td>`).join('') + '</tr>'; i++;
      }
      i--; html += '</tbody></table></div>'; continue;
    }
    if (/^(?:- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line); const tag = ordered ? 'ol' : 'ul';
      const pattern = ordered ? /^\d+\. / : /^- /;
      html += `<${tag}>`;
      while (i < lines.length && pattern.test(lines[i].trim())) {
        const item = lines[i].trim().replace(pattern, '');
        html += `<li${item.startsWith('**Heilung:') ? ' id="heilung" tabindex="-1"' : ''}>${inline(item)}</li>`; i++;
      }
      i--; html += `</${tag}>`; continue;
    }
    html += `<p>${inline(line)}</p>`;
  }
  return html;
}

export function renderRules(chapters: Chapter[], tablesHTML = ''): string {
  return `<section class="sheet-panel rules-panel" id="spielregeln" aria-labelledby="rules-title" hidden>
    <h2 id="rules-title" tabindex="-1">Spielregeln · Band 1</h2>
    <p>Eigenständig formulierte Zusammenfassungen nach den Nutzerfotos der Mantikore-Ausgabe, Seiten 18–29. AU bezeichnet Ausdauer; im Aktionsblatt wird dafür AP verwendet.</p>
    <nav aria-label="Inhaltsverzeichnis Spielregeln"><ol>${chapters.map(chapter => `<li><a href="#rules-${escape(chapter.id)}">${escape(chapter.title.replace(/^\d+\. /, ''))}</a></li>`).join('')}<li><a href="#rules-kampfresultate">Kampfresultat-Tabelle</a></li><li><a href="#rules-zufallszahlen">Zufallszahlen-Tabelle</a></li></ol></nav>
    <p>Direkt nachschlagen: <a href="#rules-kampfresultate">Kampfresultate</a> · <a href="#rules-zufallszahlen">Zufallszahlen</a>. Die Tabellen verändern deinen Spielstand nicht.</p>
    ${chapters.map(chapter => `<section aria-labelledby="rules-${escape(chapter.id)}"><h3 id="rules-${escape(chapter.id)}" tabindex="-1">${escape(chapter.title)}</h3>${renderMarkdown(chapter.markdown)}${chapter.id === 'kampf' ? '<p><a href="#kampfhelfer">Kampfhelfer öffnen</a></p>' : ''}${chapter.id === 'kampf' || chapter.id === 'startwerte' ? '<p><a href="#rules-kampfresultate">Kampfresultat-Tabelle öffnen</a> · <a href="#rules-zufallszahlen">Zufallszahlen-Tabelle öffnen</a></p>' : ''}<a href="#rules-title">Zum Inhaltsverzeichnis</a></section>`).join('')}
    ${tablesHTML}
  </section>`;
}

export function isRulesHash(hash: string): boolean {
  return hash === '#rules-title' || /^#rules-(startwerte|disziplinen|inventar|kampf|flucht|kai-rang|kampfresultate|zufallszahlen)$/.test(hash) || hash === '#heilung' || hash === '#waffenkunde';
}

const ranks = ['Novize', 'Intuite', 'Doan', 'Akolyth', 'Initiand', 'Aspirant', 'Hüter', 'Wanderer', 'Wissender', 'Meister'];
export function kaiRank(disciplines: string[]): string {
  const count = new Set(disciplines.map(value => value.trim().toLocaleLowerCase('de')).filter(Boolean)).size;
  return count ? `${ranks[count - 1] ?? 'Unbekannter Rang'} (${count} Kai-Disziplinen)` : 'Noch keine Kai-Disziplin eingetragen';
}
