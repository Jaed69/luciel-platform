import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DIST, read } from './helpers.mjs';

const home = () => read(join(DIST, 'index.html'));

test('home shows the readouts', () => {
  const html = home();
  const readouts = html.match(/<section[^>]*aria-labelledby="proof"[^]*?<\/section>/)?.[0] ?? '';
  assert.ok(readouts, 'readouts section not found');
  assert.match(readouts, /tours\.luciel\.dev/);
  assert.match(readouts, />144</);
  assert.match(readouts, /68 vitest · 76 pytest/);
  assert.match(readouts, /~90%/);
  assert.match(readouts, /(&lt;|<) 1 kB/);
  assert.match(readouts, /client JavaScript on this site/);
  assert.doesNotMatch(readouts, />0 kB</);
});

test('home shows both case studies with their status', () => {
  const html = home();
  const work = html.match(/<section[^>]*id="work"[^]*?<\/section>/)?.[0] ?? '';
  assert.ok(work, 'work section not found');
  assert.match(work, /<h3>tours<\/h3>/);
  assert.match(work, /Live · login only/);
  assert.match(work, /<h3>Accreditation assistant<\/h3>/);
  assert.match(work, /In development · faculty project/);
  for (const facet of ['Context', 'Approach', 'System', 'Outcome']) {
    assert.equal((work.match(new RegExp(`>${facet}<`, 'g')) ?? []).length, 2, `${facet} facet should appear in both cases`);
  }
  const cards = work.match(/<article[^]*?<\/article>/g) ?? [];
  assert.equal(cards.length, 2);
  assert.match(cards[0], /href="https:\/\/github\.com\/Jaed69\/luciel-platform\/tree\/main\/apps\/tours"/);
  assert.doesNotMatch(cards[1], /<a /, 'accreditation assistant has no public link');
});

test('home shows the six trajectory stops and the stack', () => {
  const html = home();
  const track = html.match(/<section[^>]*id="trajectory"[^]*?<\/section>/)?.[0] ?? '';
  assert.equal((track.match(/class="stop"/g) ?? []).length, 6);
  assert.match(html, /<section[^>]*id="stack"/);
});
