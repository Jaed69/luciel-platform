import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, read, requireDist } from './helpers.mjs';

const pagePath = () => join(DIST, 'projects', 'index.html');

const cardOf = (html, name) =>
  html.match(new RegExp(`<article[^>]*data-project="${name}"[\\s\\S]*?</article>`))?.[0] ?? '';

test('/projects/ is built', () => {
  requireDist();
  assert.ok(existsSync(pagePath()), 'dist/projects/index.html is missing');
});

test('tours is marked live and rtk, graph, hackathons are marked planned', () => {
  const html = read(pagePath());
  for (const [name, status, badge] of [
    ['tours', 'live', 'Live'],
    ['rtk', 'planned', 'Planned'],
    ['graph', 'planned', 'Planned'],
    ['hackathons', 'planned', 'Planned'],
  ]) {
    const card = cardOf(html, name);
    assert.match(card, new RegExp(`data-status="${status}"`), `${name} should be ${status}`);
    assert.match(card, new RegExp(`>\\s*${badge}\\s*</span>`),`${name} should show the ${badge} badge`);
  }
});

test('tours card renders its live link and source link', () => {
  const card = cardOf(read(pagePath()), 'tours');
  assert.match(card, /href="https:\/\/tours\.luciel\.dev"/);
  assert.match(card, /href="https:\/\/github\.com\/Jaed69\/luciel-platform\/tree\/main\/apps\/tours"/);
});

test('planned projects render no links', () => {
  const html = read(pagePath());
  for (const name of ['rtk', 'graph', 'hackathons']) {
    const card = cardOf(html, name);
    assert.ok(card, `${name} card not found`);
    assert.doesNotMatch(card, /<a /, `${name} should not link anywhere`);
  }
});

test('projects page is linked from the header', () => {
  const home = read(join(DIST, 'index.html'));
  const header = home.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(header, /href="\/projects\/"/);
});

test('projects page marks Projects as the current nav link and not Home', () => {
  const html = read(pagePath());
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(header, /<a[^>]*href="\/projects\/"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/projects\/"/);
  assert.doesNotMatch(header, /<a[^>]*href="\/"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/"/);
});
