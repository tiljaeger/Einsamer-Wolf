import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderRules, renderMarkdown, isRulesHash, kaiRank } from '../src/rules.ts';
import { renderForms } from '../src/forms.ts';
const chapters = JSON.parse(await readFile(new URL('../src/rules-data.json', import.meta.url), 'utf8'));

test('all six chapters and table values appear with working chapter anchors', () => {
  const html = renderRules(chapters);
  assert.equal(chapters.length, 6);
  for (const chapter of chapters) {
    assert.ok(html.includes(`href="#rules-${chapter.id}"`));
    assert.ok(html.includes(`id="rules-${chapter.id}"`));
    assert.ok(isRulesHash(`#rules-${chapter.id}`));
  }
  assert.equal((html.match(/<table>/g) ?? []).length, 2);
  for (const text of ['10–19', '20–29', '50 Goldkronen', 'acht', '−4 Kampfstärke', '+1 Ausdauer', '4 Ausdauer', '−3 AU', '−6 AU', 'Meister', 'Geist über Materie', 'Breitschwert']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('id="heilung"'));
  assert.ok(html.includes('id="waffenkunde"'));
});

test('context links resolve and arbitrary hashes do not activate the handbook', () => {
  const forms = renderForms();
  const html = renderRules(chapters);
  for (const [, id] of forms.matchAll(/href="#(rules-[^"]+)"/g)) {
    assert.ok(isRulesHash(`#${id}`)); assert.ok(html.includes(`id="${id}"`));
  }
  assert.equal(isRulesHash('#unknown'), false);
  assert.equal(isRulesHash('#rules-kampf-invalid'), false);
});

test('rank derives from unique entered disciplines, including blank and partial sheets', () => {
  assert.match(kaiRank(['', '  ']), /Noch keine/);
  assert.equal(kaiRank(['Jagd', ' jagd ', 'Heilung']), 'Intuite (2 Kai-Disziplinen)');
  assert.match(kaiRank(['a', 'b', 'c', 'd', 'e']), /^Initiand/);
  assert.match(kaiRank(['a', 'b', 'c', 'd', 'e', 'f']), /^Aspirant/);
});

test('editorial renderer escapes HTML and preserves ordered instructions and emphasis', () => {
  assert.equal(renderMarkdown('<script>bad</script>'), '<p>&lt;script&gt;bad&lt;/script&gt;</p>');
  assert.equal(renderMarkdown('1. **Eins**\n2. Zwei'), '<ol><li><strong>Eins</strong></li><li>Zwei</li></ol>');
});
