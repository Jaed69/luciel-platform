import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, read } from './helpers.mjs';

const pagePath = join(DIST, 'projects', 'index.html');

test('/projects/ is built', () => {
  assert.ok(existsSync(pagePath), 'dist/projects/index.html is missing');
});

test('tours is marked live and rtk, graph, hackathons are marked planned', () => {
  const html = read(pagePath);
  for (const [name, status] of [['tours', 'live'], ['rtk', 'planned'], ['graph', 'planned'], ['hackathons', 'planned']]) {
    const card = new RegExp(`<article[^>]*data-project="${name}"[^>]*data-status="${status}"`);
    assert.match(html, card, `${name} should be ${status}`);
  }
});

test('projects page is linked from the header', () => {
  const home = read(join(DIST, 'index.html'));
  const header = home.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(header, /href="\/projects\/"/);
});
